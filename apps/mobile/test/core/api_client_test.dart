import 'dart:convert';
import 'dart:typed_data';

import 'package:agromagnat/core/network/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Answers requests from a script, and records what it was asked.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final ResponseBody Function(RequestOptions options) handler;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(int status, Object body) => ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );

class _Tokens implements TokenSource {
  _Tokens({this.accessToken = 'stale'});

  @override
  String? accessToken;

  @override
  String? refreshToken = 'refresh-1';

  int refreshes = 0;
  bool lost = false;

  @override
  Future<void> onRefreshed(String access, String refresh) async {
    refreshes++;
    accessToken = access;
    refreshToken = refresh;
  }

  @override
  Future<void> onSessionLost() async => lost = true;
}

ApiClient _client(_FakeAdapter adapter, {TokenSource? tokens}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://x/api', validateStatus: (_) => true))
    ..httpClientAdapter = adapter;
  return ApiClient(dio: dio, tokens: tokens);
}

void main() {
  group('the bearer token', () {
    test('rides on every request', () async {
      final adapter = _FakeAdapter((_) => _json(200, {'ok': true}));
      await _client(adapter, tokens: _Tokens(accessToken: 'abc'))
          .get<void>('/listings', decode: (_) {});

      expect(adapter.requests.single.headers['Authorization'], 'Bearer abc');
    });

    test('is absent when signed out', () async {
      final adapter = _FakeAdapter((_) => _json(200, {'ok': true}));
      await _client(adapter).get<void>('/listings', decode: (_) {});

      expect(adapter.requests.single.headers.containsKey('Authorization'), isFalse);
    });
  });

  group('refresh on 401', () {
    test('renews the token and retries the request', () async {
      final tokens = _Tokens();
      var listingCalls = 0;

      final adapter = _FakeAdapter((options) {
        if (options.path.endsWith('/auth/refresh')) {
          return _json(200, {'accessToken': 'fresh', 'refreshToken': 'refresh-2'});
        }
        listingCalls++;
        // First attempt on the stale token, second on the fresh one.
        return listingCalls == 1
            ? _json(401, {'message': 'Sessiya tugadi'})
            : _json(200, {'items': []});
      });

      final result = await _client(adapter, tokens: tokens)
          .get<String>('/listings', decode: (_) => 'ok');

      expect(result, 'ok');
      expect(tokens.refreshes, 1);
      expect(tokens.accessToken, 'fresh');
      expect(listingCalls, 2);
    });

    test('three concurrent 401s spend exactly one refresh token', () async {
      final tokens = _Tokens();
      var refreshCalls = 0;
      final seen = <String>[];

      final adapter = _FakeAdapter((options) {
        if (options.path.endsWith('/auth/refresh')) {
          refreshCalls++;
          return _json(200, {'accessToken': 'fresh', 'refreshToken': 'refresh-2'});
        }
        final auth = options.headers['Authorization'] as String?;
        seen.add(auth ?? '');
        return auth == 'Bearer fresh'
            ? _json(200, {'ok': true})
            : _json(401, {'message': 'Sessiya tugadi'});
      });

      final client = _client(adapter, tokens: tokens);
      await Future.wait([
        client.get<void>('/a', decode: (_) {}),
        client.get<void>('/b', decode: (_) {}),
        client.get<void>('/c', decode: (_) {}),
      ]);

      // The API invalidates a refresh token on use. Three refreshes would
      // mean two rejections and a user logged out mid-session.
      expect(refreshCalls, 1);
      expect(tokens.lost, isFalse);
    });

    test('a rejected refresh token ends the session', () async {
      final tokens = _Tokens();
      final adapter = _FakeAdapter((options) {
        if (options.path.endsWith('/auth/refresh')) {
          return _json(401, {'message': 'Refresh token yaroqsiz'});
        }
        return _json(401, {'message': 'Sessiya tugadi'});
      });

      await expectLater(
        _client(adapter, tokens: tokens).get<void>('/listings', decode: (_) {}),
        throwsA(isA<ApiException>()),
      );

      // 30 days elapsed or revoked. Keeping the session means every request
      // from here on 401s in silence.
      expect(tokens.lost, isTrue);
    });

    test('being offline during a refresh does not throw the session away',
        () async {
      final tokens = _Tokens();
      final adapter = _FakeAdapter((options) {
        if (options.path.endsWith('/auth/refresh')) {
          throw DioException.connectionError(
            requestOptions: options,
            reason: 'offline',
          );
        }
        return _json(401, {'message': 'Sessiya tugadi'});
      });

      await expectLater(
        _client(adapter, tokens: tokens).get<void>('/listings', decode: (_) {}),
        throwsA(isA<ApiException>()),
      );

      // The session may still be perfectly good; the phone just has no signal.
      expect(tokens.lost, isFalse);
    });

    test('does not refresh a request that never carried a token', () async {
      final tokens = _Tokens();
      var refreshCalls = 0;

      final adapter = _FakeAdapter((options) {
        if (options.path.endsWith('/auth/refresh')) {
          refreshCalls++;
          return _json(200, {'accessToken': 'a', 'refreshToken': 'b'});
        }
        return _json(401, {'message': "Kod noto'g'ri"});
      });

      await expectLater(
        _client(adapter, tokens: tokens).post<void>(
          '/auth/verify-otp',
          body: const {},
          authenticated: false,
          decode: (_) {},
        ),
        throwsA(isA<ApiException>()),
      );

      // A wrong OTP is a 401 too, and refreshing over it would hide the real
      // message behind a session error.
      expect(refreshCalls, 0);
    });
  });

  group('errors', () {
    test('show the API\'s own Uzbek message', () async {
      final adapter = _FakeAdapter(
        (_) => _json(400, {'message': "Hajm noto'g'ri"}),
      );

      await expectLater(
        _client(adapter).get<void>('/listings', decode: (_) {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.messageUz, 'messageUz', "Hajm noto'g'ri"),
        ),
      );
    });

    test('pull each validation failure onto its field', () async {
      final adapter = _FakeAdapter(
        (_) => _json(400, {
          'message': [
            'title kamida 3 ta belgi',
            'price musbat son bo\'lishi kerak',
            'regionId noto\'g\'ri',
          ],
        }),
      );

      try {
        await _client(adapter).post<void>('/listings', decode: (_) {});
        fail('should have thrown');
      } on ApiException catch (error) {
        // The form puts each message under the field it belongs to. A single
        // "something is wrong" makes the seller hunt.
        expect(error.fieldErrors.keys, containsAll(['title', 'price', 'region']));
      }
    });

    test('a timeout says something different from a dead socket', () async {
      final timeout = _FakeAdapter(
        (options) => throw DioException.receiveTimeout(
          timeout: const Duration(seconds: 1),
          requestOptions: options,
        ),
      );

      await expectLater(
        _client(timeout).get<void>('/listings', decode: (_) {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.messageUz, 'messageUz', contains('sekin')),
        ),
      );
    });

    test('fall back to a status message when the body has none', () async {
      final adapter = _FakeAdapter((_) => _json(429, {}));

      await expectLater(
        _client(adapter).get<void>('/listings', decode: (_) {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.isRateLimited, 'isRateLimited', isTrue)
              .having((e) => e.messageUz, 'messageUz', contains("Juda ko'p")),
        ),
      );
    });
  });

  group('query parameters', () {
    test('nulls are dropped rather than sent as the string "null"', () async {
      final adapter = _FakeAdapter((_) => _json(200, {'items': []}));

      await _client(adapter).get<void>(
        '/listings',
        query: {'q': 'olma', 'categoryId': null, 'limit': 20},
        decode: (_) {},
      );

      final sent = adapter.requests.single.queryParameters;
      expect(sent.keys, ['q', 'limit']);
    });
  });
}
