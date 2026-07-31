import 'package:flutter/foundation.dart';

import '../entities/auth_user.dart';

/// Why a code could not be sent or accepted.
///
/// Modelled as a type rather than a message string because the login screen
/// reacts differently to each: a wrong code keeps the user on the code step
/// with attempts remaining, an expired one sends them back to request a new
/// one, and a rate limit disables the button for a while.
enum AuthFailureKind {
  invalidPhone,
  wrongCode,
  expiredCode,
  tooManyAttempts,
  rateLimited,
  network,
  unknown;
}

class AuthException implements Exception {
  const AuthException(this.kind, this.message, {this.retryAfter});

  final AuthFailureKind kind;

  /// Uzbek, ready to show — the backend already speaks it.
  final String message;

  /// How long until another request is allowed, when rate limited.
  final Duration? retryAfter;

  @override
  String toString() => 'AuthException($kind): $message';
}

/// The result of asking for a code.
@immutable
class OtpChallenge {
  const OtpChallenge({required this.phone, required this.expiresIn});

  final String phone;

  /// Seconds until the code dies. Drives the resend countdown, so it comes
  /// from the server rather than being guessed at by the client.
  final int expiresIn;
}

abstract interface class AuthRepository {
  /// Sends a 6-digit code. Throws [AuthException] with [AuthFailureKind
  /// .rateLimited] once the phone has asked too often.
  Future<OtpChallenge> requestOtp(String phone);

  /// Verifies the code, creating the account on first login.
  Future<AuthSession> verifyOtp({
    required String phone,
    required String code,
    String? name,
  });

  Future<AuthUser> me(String accessToken);

  Future<AuthUser> updateProfile({
    required String accessToken,
    String? name,
    String? regionId,
    String? districtId,
  });

  Future<void> logout(String refreshToken, {String? accessToken});
}
