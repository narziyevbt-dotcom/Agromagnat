@Tags(['screenshots'])
library;

import 'dart:io';

import 'package:agromagnat/features/add_listing/presentation/add_listing_screen.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/data/token_store.dart';
import 'package:agromagnat/features/auth/presentation/login_screen.dart';
import 'package:agromagnat/features/auth/presentation/providers/login_controller.dart';
import 'package:agromagnat/features/home/presentation/home_screen.dart';
import 'package:agromagnat/features/listings/presentation/listing_detail_screen.dart';
import 'package:agromagnat/features/profile/presentation/profile_screen.dart';
import 'package:agromagnat/features/search/presentation/search_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/test_harness.dart';

/// Renders each screen to a PNG so the app can be reviewed without a device.
///
/// Not a golden test — nothing is compared, and nothing fails on a pixel
/// change. It exists so the product can be looked at: an emulator needs a
/// machine with hardware acceleration, and an APK needs an Android phone in
/// hand, while this runs anywhere `flutter test` does.
///
/// Tagged so a normal `flutter test` skips it — writing eight PNGs on every
/// run would put binaries in every diff.
///
///     flutter test --tags screenshots
void main() {
  const phone = Size(390, 844); // iPhone 14 / a common Android at 1x

  setUpAll(() async {
    Directory('build/screenshots').createSync(recursive: true);

    // The test environment ships a placeholder font that draws every glyph as
    // a box. Loading the real face is what makes these screenshots readable.
    final loader = FontLoader('PlusJakartaSans')
      ..addFont(
        File('assets/fonts/PlusJakartaSans.ttf')
            .readAsBytes()
            .then((bytes) => bytes.buffer.asByteData()),
      );
    await loader.load();
  });

  Future<void> shoot(WidgetTester tester, String name) async {
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../build/screenshots/$name.png'),
    );
  }

  Future<InMemoryTokenStore> signedIn(
    WidgetTester tester,
    MockAuthRepository repository,
  ) async {
    final store = InMemoryTokenStore();
    await tester.runAsync(() async {
      await repository.requestOtp('901234567');
      await store.write(
        await repository.verifyOtp(
          phone: '+998901234567',
          code: MockAuthRepository.devCode,
          name: 'Anvar aka',
        ),
      );
    });
    return store;
  }

  Future<void> sized(WidgetTester tester) async {
    tester.view.physicalSize = phone;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('01 home', (tester) async {
    await sized(tester);
    await pumpApp(tester, const HomeScreen());
    await shoot(tester, '01-home');
  });

  testWidgets('02 search', (tester) async {
    await sized(tester);
    await pumpApp(tester, const SearchScreen());
    await shoot(tester, '02-search');
  });

  testWidgets('03 listing detail', (tester) async {
    await sized(tester);
    await pumpApp(tester, const ListingDetailScreen(id: 'lst-01'));
    await shoot(tester, '03-listing');
  });

  testWidgets('04 sign in — phone', (tester) async {
    await sized(tester);
    await pumpApp(tester, const LoginScreen());
    await tester.enterText(find.byType(TextField), '901234567');
    await tester.pumpAndSettle();
    await shoot(tester, '04-signin-phone');
  });

  testWidgets('05 sign in — code', (tester) async {
    await sized(tester);
    await pumpApp(tester, const LoginScreen());
    await tester.enterText(find.byType(TextField), '901234567');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kod yuborish'));
    await tester.pumpAndSettle();
    await shoot(tester, '05-signin-code');

    // Stops the resend countdown, which otherwise trips the pending-timer
    // check before teardown gets a chance to dispose the container.
    ProviderScope.containerOf(
      tester.element(find.byType(LoginScreen)),
      listen: false,
    ).read(loginControllerProvider.notifier).editPhone();
    await tester.pumpAndSettle();
  });

  testWidgets('06 add listing — produce', (tester) async {
    await sized(tester);
    final repository = MockAuthRepository(latency: Duration.zero);
    final store = await signedIn(tester, repository);

    await pumpApp(
      tester,
      const AddListingScreen(),
      auth: repository,
      tokenStore: store,
    );
    await tester.tap(find.textContaining('Sabzavotlar').first);
    await tester.pumpAndSettle();
    await shoot(tester, '06-add-produce');
  });

  testWidgets('07 add listing — machinery', (tester) async {
    await sized(tester);
    final repository = MockAuthRepository(latency: Duration.zero);
    final store = await signedIn(tester, repository);

    await pumpApp(
      tester,
      const AddListingScreen(),
      auth: repository,
      tokenStore: store,
    );
    await tester.tap(find.textContaining('Qishloq texnikasi').first);
    await tester.pumpAndSettle();
    // Scrolled to where the two forms visibly differ: no picking date, no
    // minimum lot, and questions produce never asks.
    await tester.drag(find.byType(ListView).first, const Offset(0, -320));
    await tester.pumpAndSettle();
    await shoot(tester, '07-add-machinery');
  });

  testWidgets('08 profile', (tester) async {
    await sized(tester);
    final repository = MockAuthRepository(latency: Duration.zero);
    final store = await signedIn(tester, repository);

    await pumpApp(
      tester,
      const ProfileScreen(),
      auth: repository,
      tokenStore: store,
    );
    await shoot(tester, '08-profile');
  });
}
