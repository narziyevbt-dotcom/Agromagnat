import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/cache/cache_providers.dart';
import '../../../../core/cache/json_cache.dart';
import '../../../../core/network/api_config.dart';
import '../../../../core/network/api_providers.dart';
import '../../data/api_auth_repository.dart';
import '../../data/mock_auth_repository.dart';
import '../../data/token_store.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';

/// The seam where the mock becomes the real API, same as the listing side.
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  if (!ApiConfig.isConfigured) {
    return MockAuthRepository();
  }
  return ApiAuthRepository(ref.watch(apiClientProvider));
});

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore();
});

/// Who is signed in, if anyone.
///
/// [AuthRestoring] is a real state rather than "signed out until proven
/// otherwise": reading the keystore takes a moment on a cold start, and
/// treating that moment as signed-out would bounce a returning user to the
/// login screen for a frame before snapping back.
@immutable
sealed class AuthState {
  const AuthState();
}

class AuthRestoring extends AuthState {
  const AuthRestoring();
}

class AuthSignedOut extends AuthState {
  const AuthSignedOut();
}

class AuthSignedIn extends AuthState {
  const AuthSignedIn(this.user, this.session);

  final AuthUser user;
  final AuthSession session;
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._repository, this._store, {this.cache})
      : super(const AuthRestoring()) {
    _ready = _restore();
  }

  final AuthRepository _repository;
  final TokenStore _store;

  /// Not private: a named parameter cannot carry an underscore.
  final JsonCache? cache;

  late final Future<void> _ready;

  /// Completes once the stored session has been read.
  ///
  /// Anything that only *reads* the auth state — rather than watching it —
  /// must await this first. A screen that does not watch auth leaves the
  /// controller uninstantiated, so the first read lands on [AuthRestoring],
  /// and treating that as signed-out sends a signed-in user to the login
  /// screen for no reason.
  Future<void> get ready => _ready;

  Future<void> _restore() async {
    final session = await _store.read();
    if (session == null) {
      state = const AuthSignedOut();
      return;
    }

    try {
      state = AuthSignedIn(await _repository.me(session.accessToken), session);
    } on Object {
      // A stored token the server no longer honours is worse than none: every
      // request would 401. Drop it and start clean.
      await _store.clear();
      state = const AuthSignedOut();
    }
  }

  /// Stores a refreshed token pair, keeping the user as they are.
  ///
  /// Called by the HTTP client after a 401 was recovered. Deliberately does
  /// not refetch the user: a token rotation is not a profile change, and a
  /// round trip here would run inside somebody else's request.
  Future<void> replaceSession(AuthSession session) async {
    final current = state;
    if (current is! AuthSignedIn) {
      return;
    }
    await _store.write(session);
    state = AuthSignedIn(current.user, session);
  }

  /// Called by the login flow once a code has been accepted.
  Future<AuthUser> adopt(AuthSession session) async {
    await _store.write(session);
    final user = await _repository.me(session.accessToken);
    state = AuthSignedIn(user, session);
    return user;
  }

  Future<void> signOut() async {
    final current = state;
    if (current is AuthSignedIn) {
      // Fire and forget the revoke: the local session must go regardless of
      // whether the phone can reach the server right now.
      try {
        await _repository.logout(
          current.session.refreshToken,
          accessToken: current.session.accessToken,
        );
      } on Object {
        // Ignored on purpose — see above.
      }
    }
    await _store.clear();
    // A cached listing carries isFavorite, which belongs to whoever was
    // signed in. Leaving it would show the next user somebody else's saved
    // hearts on a shared handset — and shared handsets are common here.
    await cache?.clear();
    state = const AuthSignedOut();
  }

  Future<void> updateProfile({
    String? name,
    String? regionId,
    String? districtId,
  }) async {
    final current = state;
    if (current is! AuthSignedIn) {
      return;
    }

    final updated = await _repository.updateProfile(
      accessToken: current.session.accessToken,
      name: name,
      regionId: regionId,
      districtId: districtId,
    );
    state = AuthSignedIn(updated, current.session);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(
    ref.watch(authRepositoryProvider),
    ref.watch(tokenStoreProvider),
    cache: ref.watch(jsonCacheProvider),
  );
});

/// The signed-in user, or null. What most screens actually want.
final currentUserProvider = Provider<AuthUser?>((ref) {
  final state = ref.watch(authControllerProvider);
  return state is AuthSignedIn ? state.user : null;
});

final isSignedInProvider = Provider<bool>((ref) {
  return ref.watch(authControllerProvider) is AuthSignedIn;
});
