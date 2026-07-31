import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/domain/entities/auth_user.dart';
import '../../features/auth/presentation/providers/auth_providers.dart';
import 'api_client.dart';
import 'api_config.dart';

/// Bridges the session onto the HTTP client.
///
/// The client needs a token and a way to refresh it; the auth feature owns
/// both. This adapter is what lets the dependency point one way — auth knows
/// about the client, the client only knows about this interface.
class _SessionTokenSource implements TokenSource {
  _SessionTokenSource(this._ref);

  final Ref _ref;

  AuthState get _state => _ref.read(authControllerProvider);

  @override
  String? get accessToken {
    final state = _state;
    return state is AuthSignedIn ? state.session.accessToken : null;
  }

  @override
  String? get refreshToken {
    final state = _state;
    return state is AuthSignedIn ? state.session.refreshToken : null;
  }

  @override
  Future<void> onRefreshed(String accessToken, String refreshToken) {
    return _ref.read(authControllerProvider.notifier).replaceSession(
          AuthSession(accessToken: accessToken, refreshToken: refreshToken),
        );
  }

  @override
  Future<void> onSessionLost() {
    // Clears the stored pair and returns the app to signed-out. Without this
    // every request from here on 401s in silence and the app looks broken
    // rather than logged out.
    return _ref.read(authControllerProvider.notifier).signOut();
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(tokens: _SessionTokenSource(ref));
});

/// Whether the app is talking to a backend at all.
///
/// False means every repository stays on its mock, which is a supported way to
/// run: it is how the screens were built, and it keeps the app openable with
/// nothing behind it. Set at build time — see [ApiConfig].
final hasBackendProvider = Provider<bool>((ref) => ApiConfig.isConfigured);
