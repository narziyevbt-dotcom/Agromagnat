import '../../../core/network/api_client.dart';
import '../../listings/data/api/listing_mapper.dart';
import '../domain/entities/auth_user.dart';
import '../domain/repositories/auth_repository.dart';

/// Phone + OTP against the real API.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._client);

  final ApiClient _client;

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    final normalised = normalisePhone(phone);
    if (!isValidPhone(normalised)) {
      // Caught here rather than spending a request to be told the same thing.
      throw const AuthException(
        AuthFailureKind.invalidPhone,
        "Telefon raqami +998XXXXXXXXX ko'rinishida bo'lishi kerak",
      );
    }

    try {
      return await _client.post(
        '/auth/request-otp',
        body: {'phone': normalised},
        authenticated: false,
        decode: (body) {
          final map = body is Map ? body : const {};
          return OtpChallenge(
            phone: normalised,
            // The countdown comes from the server so the resend button never
            // unlocks before the code has actually expired.
            expiresIn: ListingMapper.intOr(map['expiresIn'], 300),
          );
        },
      );
    } on ApiException catch (error) {
      throw _toAuthException(error);
    }
  }

  @override
  Future<AuthSession> verifyOtp({
    required String phone,
    required String code,
    String? name,
  }) async {
    try {
      return await _client.post(
        '/auth/verify-otp',
        body: {
          'phone': normalisePhone(phone),
          'code': code,
          if (name != null && name.trim().isNotEmpty) 'name': name.trim(),
        },
        authenticated: false,
        decode: (body) {
          final map = body is Map ? body : const {};
          return AuthSession(
            accessToken: map['accessToken'] as String,
            refreshToken: map['refreshToken'] as String,
            isNewUser: map['isNewUser'] as bool? ?? false,
          );
        },
      );
    } on ApiException catch (error) {
      throw _toAuthException(error);
    }
  }

  @override
  Future<AuthUser> me(String accessToken) async {
    try {
      // Sent explicitly. During sign-in the session exists but has not been
      // adopted yet, so the client's token source still reports nothing and
      // the request would go out unauthenticated.
      return await _client.get('/auth/me', decode: _user, bearer: accessToken);
    } on ApiException catch (error) {
      throw _toAuthException(error);
    }
  }

  @override
  Future<AuthUser> updateProfile({
    required String accessToken,
    String? name,
    String? regionId,
    String? districtId,
  }) async {
    try {
      return await _client.patch(
        '/auth/me',
        body: {
          if (name != null) 'name': name,
          if (regionId != null) 'regionId': regionId,
          if (districtId != null) 'districtId': districtId,
        },
        decode: _user,
        bearer: accessToken,
      );
    } on ApiException catch (error) {
      throw _toAuthException(error);
    }
  }

  @override
  Future<void> logout(String refreshToken, {String? accessToken}) async {
    // Best-effort. The local session is cleared regardless — see
    // AuthController.signOut — because a phone with no signal must still be
    // able to sign out.
    await _client.post<void>(
      '/auth/logout',
      body: {'refreshToken': refreshToken},
      decode: (_) {},
      // Signing out clears the session before this lands, so the token has to
      // travel with the request rather than be looked up from it.
      bearer: accessToken,
    );
  }

  static AuthUser _user(dynamic body) {
    final map = body is Map ? body : const {};
    return AuthUser(
      id: map['id'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      name: ListingMapper.text(map['name']),
      role: UserRole.fromWire(map['role'] as String?),
      isVerified: map['isVerified'] as bool? ?? false,
      ratingAvg: ListingMapper.number(map['ratingAvg'])?.toDouble() ?? 0,
      ratingCount: ListingMapper.intOr(map['ratingCount'], 0),
      salesCount: ListingMapper.intOr(map['salesCount'], 0),
      region: ListingMapper.region(map['region']),
      district: ListingMapper.district(map['district']),
    );
  }

  /// The status decides what the login screen does next, so it is not enough
  /// to pass the message through: an expired code sends the seller back to
  /// request a new one, a wrong one leaves them typing.
  static AuthException _toAuthException(ApiException error) {
    final kind = switch (error.status) {
      429 => AuthFailureKind.rateLimited,
      401 => _kindFromMessage(error.messageUz),
      400 => AuthFailureKind.invalidPhone,
      0 => AuthFailureKind.network,
      _ => AuthFailureKind.unknown,
    };
    return AuthException(kind, error.messageUz);
  }

  /// The API answers a bad code with 401 and an Uzbek reason. The reason is
  /// what distinguishes "wrong" from "expired", and the two need different
  /// screens.
  static AuthFailureKind _kindFromMessage(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('muddat') || lower.contains('eskir')) {
      return AuthFailureKind.expiredCode;
    }
    if (lower.contains("ko'p") || lower.contains('urinish')) {
      return AuthFailureKind.tooManyAttempts;
    }
    return AuthFailureKind.wrongCode;
  }

  /// Matches the backend's `normalisePhone` transform.
  static String normalisePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return raw;
    }
    if (digits.length == 9) {
      return '+998$digits';
    }
    return '+$digits';
  }

  static bool isValidPhone(String normalised) =>
      RegExp(r'^\+998\d{9}$').hasMatch(normalised);
}
