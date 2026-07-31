import 'dart:async';

import 'package:dio/dio.dart';

import 'api_config.dart';

/// Something the API said no to, with the message it said it in.
///
/// The backend speaks Uzbek — its validation messages are written for the
/// person reading them — so they are shown verbatim rather than translated a
/// second time on the client.
class ApiException implements Exception {
  const ApiException(this.status, this.messageUz, {this.fieldErrors = const {}});

  final int status;
  final String messageUz;

  /// Field key → message, when the API rejected specific fields.
  final Map<String, String> fieldErrors;

  bool get isUnauthorized => status == 401;
  bool get isRateLimited => status == 429;
  bool get isNotFound => status == 404;

  @override
  String toString() => 'ApiException($status): $messageUz';
}

/// Where the session lives, from the client's point of view.
///
/// An interface so the client does not depend on the auth feature — auth
/// depends on the client, and the arrow only points one way.
abstract interface class TokenSource {
  String? get accessToken;
  String? get refreshToken;

  /// Stores a refreshed pair.
  Future<void> onRefreshed(String accessToken, String refreshToken);

  /// The refresh token was rejected; the session is over.
  Future<void> onSessionLost();
}

/// Dio with the two things every request needs: the bearer token, and a
/// single-flight refresh when it has expired.
class ApiClient {
  ApiClient({Dio? dio, this.tokens}) : dio = dio ?? _defaultDio() {
    this.dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = tokens?.accessToken;
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  static Dio _defaultDio() => Dio(
        BaseOptions(
          baseUrl: ApiConfig.baseUrl,
          connectTimeout: ApiConfig.connectTimeout,
          receiveTimeout: ApiConfig.receiveTimeout,
          // Every status is handled here rather than thrown by Dio, so there
          // is one error path instead of two.
          validateStatus: (_) => true,
        ),
      );

  final Dio dio;

  /// Not private: a named parameter cannot carry an underscore, and routing it
  /// through an initializer for the sake of one is noise.
  final TokenSource? tokens;

  /// In flight, if a refresh is happening.
  ///
  /// Single-flight on purpose: a screen that fires three requests at once on a
  /// stale token would otherwise spend three refresh tokens, and the API
  /// invalidates each one on use — the second and third would fail and log the
  /// user out mid-session.
  Future<bool>? _refreshing;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic body) decode,
  }) {
    return _send(
      () => dio.get<dynamic>(path, queryParameters: _clean(query)),
      decode,
    );
  }

  Future<T> post<T>(
    String path, {
    Object? body,
    required T Function(dynamic body) decode,
    bool authenticated = true,
  }) {
    return _send(
      () => dio.post<dynamic>(path, data: body),
      decode,
      authenticated: authenticated,
    );
  }

  Future<T> patch<T>(
    String path, {
    Object? body,
    required T Function(dynamic body) decode,
  }) {
    return _send(() => dio.patch<dynamic>(path, data: body), decode);
  }

  Future<void> delete(String path) {
    return _send(() => dio.delete<dynamic>(path), (_) {});
  }

  /// Multipart, with the upload's own timeout.
  Future<T> upload<T>(
    String path,
    FormData form, {
    required T Function(dynamic body) decode,
  }) {
    return _send(
      () => dio.post<dynamic>(
        path,
        data: form,
        options: Options(sendTimeout: ApiConfig.uploadTimeout),
      ),
      decode,
    );
  }

  Future<T> _send<T>(
    Future<Response<dynamic>> Function() request,
    T Function(dynamic body) decode, {
    bool authenticated = true,
  }) async {
    Response<dynamic> response;
    try {
      response = await request();
    } on DioException catch (error) {
      // A timeout or a dead socket is not a status code, and the difference
      // matters to the reader: one means "try again", the other "check your
      // connection".
      throw ApiException(0, _networkMessage(error));
    }

    if (response.statusCode == 401 && authenticated && tokens != null) {
      if (await _refresh()) {
        try {
          response = await request();
        } on DioException catch (error) {
          throw ApiException(0, _networkMessage(error));
        }
      }
    }

    final status = response.statusCode ?? 0;
    if (status >= 200 && status < 300) {
      return decode(response.data);
    }

    throw _toException(status, response.data);
  }

  Future<bool> _refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final token = tokens?.refreshToken;
    if (token == null) {
      return false;
    }

    try {
      final response = await dio.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': token},
        // The refresh call must not carry the expired bearer, or it recurses.
        options: Options(headers: {'Authorization': null}),
      );

      final status = response.statusCode ?? 0;
      final body = response.data;
      if (status >= 200 && status < 300 && body is Map) {
        await tokens!.onRefreshed(
          body['accessToken'] as String,
          body['refreshToken'] as String,
        );
        return true;
      }
    } on DioException {
      // Offline. The session may still be good, so it is not thrown away —
      // the caller sees the original 401 and the next attempt can succeed.
      return false;
    }

    // The refresh token itself was rejected: 30 days elapsed, or it was
    // revoked. That is the end of the session, and pretending otherwise means
    // every request from here on 401s in silence.
    await tokens!.onSessionLost();
    return false;
  }

  ApiException _toException(int status, dynamic body) {
    final message = _messageFrom(body) ?? _statusMessage(status);
    return ApiException(status, message, fieldErrors: _fieldErrorsFrom(body));
  }

  /// Nest returns `message` as a string, or an array of validation failures.
  static String? _messageFrom(dynamic body) {
    if (body is! Map) {
      return null;
    }
    final message = body['message'];
    if (message is String && message.isNotEmpty) {
      return message;
    }
    if (message is List && message.isNotEmpty) {
      return message.first.toString();
    }
    return null;
  }

  /// Every validation message, so the form can show each under its own field.
  ///
  /// Nest's array is flat strings rather than keyed, so this is best-effort:
  /// the leading token of each message is matched against the field names the
  /// form knows. Anything unmatched still reaches the user through
  /// [ApiException.messageUz].
  static Map<String, String> _fieldErrorsFrom(dynamic body) {
    if (body is! Map || body['message'] is! List) {
      return const {};
    }

    const fields = [
      'title', 'description', 'quantity', 'price', 'minOrder',
      'categoryId', 'regionId', 'districtId', 'harvestDate', 'phone', 'code',
    ];

    final errors = <String, String>{};
    for (final entry in body['message'] as List) {
      final text = entry.toString();
      for (final field in fields) {
        if (text.startsWith(field) || text.contains(' $field ')) {
          errors.putIfAbsent(_formKey(field), () => text);
          break;
        }
      }
    }
    return errors;
  }

  /// The API names a relation by its id; the form names it by the thing.
  static String _formKey(String apiField) => switch (apiField) {
        'categoryId' => 'category',
        'regionId' => 'region',
        'districtId' => 'district',
        _ => apiField,
      };

  static String _networkMessage(DioException error) {
    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        "Internet sekin. Qayta urinib ko'ring",
      _ => "Internetga ulanib bo'lmadi",
    };
  }

  static String _statusMessage(int status) => switch (status) {
        401 => 'Sessiya tugadi. Qayta kiring',
        403 => "Bunga ruxsat yo'q",
        404 => 'Topilmadi',
        429 => "Juda ko'p so'rov. Birozdan keyin urinib ko'ring",
        >= 500 => "Serverda xatolik. Birozdan keyin urinib ko'ring",
        _ => "So'rov bajarilmadi",
      };

  /// Dio sends `null` values as the string "null", which the API then rejects.
  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) {
      return null;
    }
    final cleaned = <String, dynamic>{
      for (final entry in query.entries)
        if (entry.value != null) entry.key: entry.value,
    };
    return cleaned.isEmpty ? null : cleaned;
  }
}
