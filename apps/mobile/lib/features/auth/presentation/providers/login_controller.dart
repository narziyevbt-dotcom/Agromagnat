import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_providers.dart';

enum LoginStep { phone, code }

@immutable
class LoginState {
  const LoginState({
    this.step = LoginStep.phone,
    this.phone = '',
    this.busy = false,
    this.error,
    this.secondsLeft = 0,
    this.isNewUser = false,
  });

  final LoginStep step;

  /// Normalised, +998XXXXXXXXX.
  final String phone;

  final bool busy;

  /// Uzbek, ready to show. Cleared on the next edit so it does not linger over
  /// a field the user has already fixed.
  final String? error;

  /// Counts down to when a new code may be requested. Comes from the server's
  /// `expiresIn` rather than a guess, so the button never unlocks early.
  final int secondsLeft;

  final bool isNewUser;

  bool get canResend => step == LoginStep.code && secondsLeft == 0 && !busy;

  LoginState copyWith({
    LoginStep? step,
    String? phone,
    bool? busy,
    Object? error = _unset,
    int? secondsLeft,
    bool? isNewUser,
  }) {
    return LoginState(
      step: step ?? this.step,
      phone: phone ?? this.phone,
      busy: busy ?? this.busy,
      error: error == _unset ? this.error : error as String?,
      secondsLeft: secondsLeft ?? this.secondsLeft,
      isNewUser: isNewUser ?? this.isNewUser,
    );
  }

  static const Object _unset = Object();
}

/// Drives the two-step login: phone, then the code that was sent to it.
class LoginController extends StateNotifier<LoginState> {
  LoginController(this._repository, this._auth) : super(const LoginState());

  final AuthRepository _repository;
  final AuthController _auth;

  Timer? _ticker;

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void clearError() {
    if (state.error != null) {
      state = state.copyWith(error: null);
    }
  }

  /// Sends a code and moves to the code step.
  Future<void> requestCode(String rawPhone) async {
    if (state.busy) {
      return;
    }
    state = state.copyWith(busy: true, error: null);

    try {
      final challenge = await _repository.requestOtp(rawPhone);
      state = state.copyWith(
        step: LoginStep.code,
        phone: challenge.phone,
        busy: false,
        error: null,
      );
      _startCountdown(challenge.expiresIn);
    } on AuthException catch (error) {
      state = state.copyWith(busy: false, error: error.message);
      // A rate limit has its own clock; showing the countdown tells the user
      // how long the wait actually is instead of leaving them tapping.
      if (error.retryAfter != null) {
        _startCountdown(error.retryAfter!.inSeconds);
      }
    } on Object {
      state = state.copyWith(
        busy: false,
        error: "Internetga ulanib bo'lmadi. Qayta urinib ko'ring",
      );
    }
  }

  Future<void> resend() async {
    if (!state.canResend) {
      return;
    }
    await requestCode(state.phone);
  }

  /// Verifies the code and hands the session to [AuthController].
  ///
  /// Returns the user on success, null on failure — the screen reads the error
  /// off the state rather than catching.
  Future<AuthUser?> submitCode(String code, {String? name}) async {
    if (state.busy) {
      return null;
    }
    state = state.copyWith(busy: true, error: null);

    try {
      final session = await _repository.verifyOtp(
        phone: state.phone,
        code: code,
        name: name,
      );
      final user = await _auth.adopt(session);

      _ticker?.cancel();
      state = state.copyWith(busy: false, isNewUser: session.isNewUser);
      return user;
    } on AuthException catch (error) {
      // An expired or burned code is not something the user can fix by typing
      // again — send them back to ask for a new one.
      final backToPhone = error.kind == AuthFailureKind.expiredCode ||
          error.kind == AuthFailureKind.tooManyAttempts;

      state = state.copyWith(
        busy: false,
        error: error.message,
        step: backToPhone ? LoginStep.phone : null,
        secondsLeft: backToPhone ? 0 : null,
      );
      if (backToPhone) {
        _ticker?.cancel();
      }
      return null;
    } on Object {
      state = state.copyWith(
        busy: false,
        error: "Internetga ulanib bo'lmadi. Qayta urinib ko'ring",
      );
      return null;
    }
  }

  /// Back to the phone step, e.g. the user mistyped the number.
  void editPhone() {
    _ticker?.cancel();
    state = state.copyWith(step: LoginStep.phone, secondsLeft: 0, error: null);
  }

  void _startCountdown(int seconds) {
    _ticker?.cancel();
    state = state.copyWith(secondsLeft: seconds);

    _ticker = Timer.periodic(const Duration(seconds: 1), (timer) {
      final next = state.secondsLeft - 1;
      if (next <= 0) {
        timer.cancel();
        state = state.copyWith(secondsLeft: 0);
        return;
      }
      state = state.copyWith(secondsLeft: next);
    });
  }
}

final loginControllerProvider =
    StateNotifierProvider.autoDispose<LoginController, LoginState>((ref) {
  return LoginController(
    ref.watch(authRepositoryProvider),
    ref.watch(authControllerProvider.notifier),
  );
});
