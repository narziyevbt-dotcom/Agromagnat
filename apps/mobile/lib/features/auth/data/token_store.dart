import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/entities/auth_user.dart';

/// Where the session lives between app launches.
///
/// An interface so tests can run without touching the platform keystore, which
/// has no implementation under `flutter test`.
abstract interface class TokenStore {
  Future<AuthSession?> read();

  Future<void> write(AuthSession session);

  Future<void> clear();
}

/// Keystore on Android, Keychain on iOS.
///
/// A refresh token is good for 30 days, so it is the most valuable thing the
/// app holds. SharedPreferences would put it in a plain XML file that adb
/// backup or any process on a rooted handset can read; the platform keystore
/// keeps it out of both.
class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              // Android needs no options: the plugin encrypts with its own
              // ciphers by default now that Jetpack Security is deprecated.
              iOptions: IOSOptions(
                // The session should survive a reboot without the user having
                // to unlock first — the app opens to a feed, not a vault.
                accessibility: KeychainAccessibility.first_unlock,
              ),
            );

  final FlutterSecureStorage _storage;

  static const String _accessKey = 'agm_access_token';
  static const String _refreshKey = 'agm_refresh_token';

  @override
  Future<AuthSession?> read() async {
    final access = await _storage.read(key: _accessKey);
    final refresh = await _storage.read(key: _refreshKey);

    // Half a session is no session: without a refresh token an expired access
    // token cannot be renewed, and the user would hit a silent 401 wall.
    if (access == null || refresh == null) {
      return null;
    }
    return AuthSession(accessToken: access, refreshToken: refresh);
  }

  @override
  Future<void> write(AuthSession session) async {
    await _storage.write(key: _accessKey, value: session.accessToken);
    await _storage.write(key: _refreshKey, value: session.refreshToken);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: _accessKey);
    await _storage.delete(key: _refreshKey);
  }
}

/// Holds the session in memory only. Used by tests and by the mock repository.
class InMemoryTokenStore implements TokenStore {
  AuthSession? _session;

  @override
  Future<AuthSession?> read() async => _session;

  @override
  Future<void> write(AuthSession session) async => _session = session;

  @override
  Future<void> clear() async => _session = null;
}
