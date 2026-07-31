import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/data/token_store.dart';
import 'package:agromagnat/features/auth/domain/entities/auth_user.dart';
import 'package:agromagnat/features/auth/presentation/providers/auth_providers.dart';
import 'package:agromagnat/features/auth/presentation/widgets/sign_in_gate.dart';
import 'package:agromagnat/features/profile/presentation/profile_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

/// Signs a user in and returns the store holding their session.
///
/// The work runs inside [WidgetTester.runAsync] because `testWidgets` executes
/// its body under fake async: the repository's `Future.delayed` would never
/// fire, and the await would hang the test rather than fail it.
Future<InMemoryTokenStore> seedSession(
  WidgetTester tester,
  MockAuthRepository repository, {
  String? name,
}) async {
  final store = InMemoryTokenStore();
  await tester.runAsync(() async {
    await repository.requestOtp('901234567');
    await store.write(
      await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
        name: name,
      ),
    );
  });
  return store;
}

void main() {
  group('gate', () {
    testWidgets('shows the reason and a way in when signed out', (tester) async {
      await pumpApp(
        tester,
        const Scaffold(
          body: SignInGate(
            reason: AppStrings.signInRequiredAdd,
            child: Text('secret'),
          ),
        ),
      );

      expect(find.text('secret'), findsNothing);
      expect(find.text(AppStrings.signInRequired), findsOneWidget);
      // The reason is specific to the screen — "sign in" alone does not tell a
      // farmer why posting needs an account.
      expect(find.text(AppStrings.signInRequiredAdd), findsOneWidget);
    });

    testWidgets('shows the content once signed in', (tester) async {
      final repository = MockAuthRepository(latency: Duration.zero);
      final store = await seedSession(tester, repository, name: 'Anvar aka');

      await pumpApp(
        tester,
        const Scaffold(
          body: SignInGate(
            reason: AppStrings.signInRequiredAdd,
            child: Text('secret'),
          ),
        ),
        auth: repository,
        tokenStore: store,
      );

      expect(find.text('secret'), findsOneWidget);
      expect(find.text(AppStrings.signInRequired), findsNothing);
    });
  });

  group('session restore', () {
    testWidgets('a stored session signs the user straight back in',
        (tester) async {
      final repository = MockAuthRepository(latency: Duration.zero);
      final store = await seedSession(tester, repository);

      final container = await pumpApp(
        tester,
        const ProfileScreen(),
        auth: repository,
        tokenStore: store,
      );

      expect(container.read(isSignedInProvider), isTrue);
      expect(find.text('+998 90 123 45 67'), findsOneWidget);
    });

    testWidgets('a token the server no longer honours is discarded',
        (tester) async {
      final store = InMemoryTokenStore();
      await tester.runAsync(
        () => store.write(
          const AuthSession(accessToken: 'stale', refreshToken: 'stale'),
        ),
      );

      final container = await pumpApp(
        tester,
        const ProfileScreen(),
        tokenStore: store,
      );

      // Keeping it would 401 every request from here on.
      expect(container.read(isSignedInProvider), isFalse);
      expect(await tester.runAsync(store.read), isNull);
      expect(find.text(AppStrings.signInRequired), findsOneWidget);
    });
  });

  group('sign out', () {
    testWidgets('asks first, then clears the stored session', (tester) async {
      final repository = MockAuthRepository(latency: Duration.zero);
      final store = await seedSession(tester, repository);

      final container = await pumpApp(
        tester,
        const ProfileScreen(),
        auth: repository,
        tokenStore: store,
      );

      await tester.tap(find.text(AppStrings.signOut));
      await tester.pumpAndSettle();

      // Signing back in costs an SMS round trip, so it is confirmed.
      expect(find.text(AppStrings.signOutConfirm), findsOneWidget);
      expect(container.read(isSignedInProvider), isTrue);

      await tester.tap(find.text(AppStrings.cancel));
      await tester.pumpAndSettle();
      expect(container.read(isSignedInProvider), isTrue);

      await tester.tap(find.text(AppStrings.signOut));
      await tester.pumpAndSettle();
      await tester.tap(find.text(AppStrings.signOut).last);
      await tester.pumpAndSettle();

      expect(container.read(isSignedInProvider), isFalse);
      expect(await tester.runAsync(store.read), isNull);
    });
  });
}
