import '../../listings/data/fixtures/catalog_fixtures.dart';
import '../domain/entities/auth_user.dart';
import '../domain/repositories/auth_repository.dart';

/// In-memory [AuthRepository] mirroring the backend's OTP rules.
///
/// The rules are copied rather than approximated — 6-digit code, 5-minute TTL,
/// 3 requests per phone per 10 minutes, 5 wrong guesses before the code is
/// burned — because the login screen's countdown, its attempt counter and its
/// disabled states are all written against them. A mock that accepted any code
/// would leave every one of those paths untested until the API arrived.
///
/// In dev the backend prints the code instead of sending an SMS; here it is
/// fixed at [devCode] and exposed so the screen can show a dev hint.
class MockAuthRepository implements AuthRepository {
  MockAuthRepository({
    this.latency = const Duration(milliseconds: 400),
    DateTime Function()? clock,
  }) : _now = clock ?? DateTime.now;

  final Duration latency;
  final DateTime Function() _now;

  /// The code every mock login accepts.
  static const String devCode = '000000';

  static const int _ttlSeconds = 300;
  static const int _maxAttempts = 5;
  static const int _maxRequestsPerWindow = 3;
  static const Duration _rateWindow = Duration(minutes: 10);

  final Map<String, _Challenge> _challenges = {};
  final Map<String, List<DateTime>> _requests = {};
  final Map<String, AuthUser> _users = {};
  final Map<String, String> _sessions = {};

  @override
  Future<OtpChallenge> requestOtp(String phone) async {
    final normalised = normalisePhone(phone);
    if (!isValidPhone(normalised)) {
      throw const AuthException(
        AuthFailureKind.invalidPhone,
        "Telefon raqami +998XXXXXXXXX ko'rinishida bo'lishi kerak",
      );
    }

    await Future<void>.delayed(latency);

    final now = _now();
    final recent = (_requests[normalised] ?? const <DateTime>[])
        .where((at) => now.difference(at) < _rateWindow)
        .toList();

    if (recent.length >= _maxRequestsPerWindow) {
      final oldest = recent.first;
      throw AuthException(
        AuthFailureKind.rateLimited,
        "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring",
        retryAfter: _rateWindow - now.difference(oldest),
      );
    }

    _requests[normalised] = [...recent, now];
    _challenges[normalised] = _Challenge(
      code: devCode,
      issuedAt: now,
      attempts: 0,
    );

    return OtpChallenge(phone: normalised, expiresIn: _ttlSeconds);
  }

  @override
  Future<AuthSession> verifyOtp({
    required String phone,
    required String code,
    String? name,
  }) async {
    await Future<void>.delayed(latency);

    final normalised = normalisePhone(phone);
    final challenge = _challenges[normalised];

    if (challenge == null) {
      throw const AuthException(
        AuthFailureKind.expiredCode,
        "Kod muddati tugagan. Yangi kod so'rang",
      );
    }

    if (_now().difference(challenge.issuedAt).inSeconds > _ttlSeconds) {
      _challenges.remove(normalised);
      throw const AuthException(
        AuthFailureKind.expiredCode,
        "Kod muddati tugagan. Yangi kod so'rang",
      );
    }

    if (challenge.attempts >= _maxAttempts) {
      _challenges.remove(normalised);
      throw const AuthException(
        AuthFailureKind.tooManyAttempts,
        "Juda ko'p noto'g'ri urinish. Yangi kod so'rang",
      );
    }

    if (code != challenge.code) {
      challenge.attempts++;
      throw const AuthException(
        AuthFailureKind.wrongCode,
        "Kod noto'g'ri",
      );
    }

    _challenges.remove(normalised);
    // A successful login clears the throttle, so signing in and straight back
    // out does not leave the phone locked out.
    _requests.remove(normalised);

    final existing = _users[normalised];
    final isNewUser = existing == null;

    final user = existing ??
        AuthUser(
          id: 'usr-${_users.length + 1}',
          phone: normalised,
          name: name?.trim().isNotEmpty == true ? name!.trim() : null,
          region: CatalogFixtures.regions.first,
        );
    _users[normalised] = user;

    final accessToken = 'mock-access-${user.id}';
    _sessions[accessToken] = normalised;

    return AuthSession(
      accessToken: accessToken,
      refreshToken: 'mock-refresh-${user.id}',
      isNewUser: isNewUser,
    );
  }

  @override
  Future<AuthUser> me(String accessToken) async {
    await Future<void>.delayed(latency);

    final phone = _sessions[accessToken];
    final user = phone == null ? null : _users[phone];
    if (user == null) {
      throw const AuthException(
        AuthFailureKind.unknown,
        "Sessiya tugagan. Qayta kiring",
      );
    }
    return user;
  }

  @override
  Future<AuthUser> updateProfile({
    required String accessToken,
    String? name,
    String? regionId,
    String? districtId,
  }) async {
    final current = await me(accessToken);

    final updated = current.copyWith(
      name: name,
      region: regionId == null ? null : CatalogFixtures.regionById(regionId),
      district: districtId == null ? null : CatalogFixtures.districtById(districtId),
    );
    _users[current.phone] = updated;

    return updated;
  }

  @override
  Future<void> logout(String refreshToken, {String? accessToken}) async {
    await Future<void>.delayed(latency);
    if (accessToken != null) {
      _sessions.remove(accessToken);
    }
  }

  /// Strips everything but digits and re-adds the plus, matching the
  /// backend's `normalisePhone` transform. People type "90 123 45 67",
  /// "+998 90 123-45-67" and "998901234567" and all three must work.
  static String normalisePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return raw;
    }
    // A bare 9-digit national number is what the login field collects.
    if (digits.length == 9) {
      return '+998$digits';
    }
    return '+$digits';
  }

  static bool isValidPhone(String normalised) =>
      RegExp(r'^\+998\d{9}$').hasMatch(normalised);
}

class _Challenge {
  _Challenge({
    required this.code,
    required this.issuedAt,
    required this.attempts,
  });

  final String code;
  final DateTime issuedAt;
  int attempts;
}
