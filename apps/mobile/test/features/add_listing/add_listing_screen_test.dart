import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/add_listing/presentation/add_listing_screen.dart';
import 'package:agromagnat/features/add_listing/presentation/providers/draft_controller.dart';
import 'package:agromagnat/features/add_listing/presentation/widgets/attribute_fields.dart';
import 'package:agromagnat/features/add_listing/presentation/widgets/photo_picker_field.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/data/token_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';
import 'photos_test.dart' show FakePhotoPicker, photo;

/// The screen's job is to render whatever the category's spec says and collect
/// the answers. These tests hold it to that: nothing here asserts that a
/// tractor has a condition because the screen says so — it asserts it because
/// the spec does, and the screen obeyed.
void main() {
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
        ),
      );
    });
    return store;
  }

  /// Pumps the form on a surface tall enough to hold all of it.
  ///
  /// The form lives in a ListView, which only builds what is on screen. On the
  /// default 800x600 that makes `findsNothing` meaningless — a field could be
  /// absent because the spec omitted it or because it is simply below the
  /// fold, and these tests turn on telling those apart.
  late FakePhotoPicker picker;

  setUp(() => picker = FakePhotoPicker());

  Future<void> pumpForm(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1000, 4000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final repository = MockAuthRepository(latency: Duration.zero);
    final store = await signedIn(tester, repository);

    await pumpApp(
      tester,
      const AddListingScreen(),
      auth: repository,
      tokenStore: store,
      overrides: [photoPickerProvider.overrideWithValue(picker)],
    );
  }

  Future<void> chooseCategory(WidgetTester tester, String label) async {
    await tester.tap(find.textContaining(label).first);
    await tester.pumpAndSettle();
  }

  /// Fills in everything the produce spec requires and taps publish.
  Future<void> completeForm(WidgetTester tester) async {
    await chooseCategory(tester, 'Sabzavotlar');

    await tester.enterText(find.byType(TextFormField).first, 'Urgut pomidori');
    await tester.pumpAndSettle();

    // Volume, then price — the two numeric fields the spec put in order.
    final numbers = find.byType(TextFormField);
    await tester.enterText(numbers.at(1), '12');
    await tester.pumpAndSettle();
    await tester.enterText(numbers.at(2), '9500');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Samarqand'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Urgut'));
    await tester.pumpAndSettle();

    await tester.tap(find.text(AppStrings.publish));
    await tester.pumpAndSettle();
  }

  testWidgets('asks a signed-out user to sign in before anything else',
      (tester) async {
    await pumpApp(tester, const AddListingScreen());

    expect(find.text(AppStrings.signInRequiredAdd), findsOneWidget);
    expect(find.text(AppStrings.chooseCategory), findsNothing);
  });

  testWidgets('shows only the category question until one is chosen',
      (tester) async {
    await pumpForm(tester);

    expect(find.text(AppStrings.chooseCategory), findsOneWidget);
    // A volume field with no legal unit behind it is a question the seller
    // cannot answer yet.
    expect(find.text(AppStrings.listingTitle), findsNothing);
  });

  group('the form follows the category spec', () {
    testWidgets('produce is asked for a picking date and a minimum lot',
        (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Sabzavotlar');

      expect(find.text(AppStrings.listingTitle), findsOneWidget);
      expect(find.text('Hajm'), findsOneWidget);

      expect(find.text(AppStrings.harvestDate), findsOneWidget);
      expect(find.text(AppStrings.minOrder), findsOneWidget);
    });

    testWidgets('machinery is asked for none of those', (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Qishloq texnikasi');

      // The label itself changes: "Nechta", not "Hajm".
      expect(find.text('Nechta'), findsOneWidget);
      expect(find.text('Hajm'), findsNothing);

      expect(find.text(AppStrings.harvestDate), findsNothing);
      expect(find.text(AppStrings.minOrder), findsNothing);
    });

    testWidgets('machinery gets its own questions', (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Qishloq texnikasi');

      expect(find.text('Holati'), findsOneWidget);
      expect(find.text('Ishlab chiqarilgan yil'), findsOneWidget);
      expect(find.text('Rusumi'), findsOneWidget);
    });

    testWidgets('a single-unit category renders its unit locked',
        (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Qishloq texnikasi');

      // A select offering one option looks interactive and is not.
      final chip = tester.widget<ChoiceChipButton>(
        find
            .byWidgetPredicate(
              (widget) => widget is ChoiceChipButton && widget.label == 'dona',
            )
            .first,
      );
      expect(chip.enabled, isFalse);
      expect(chip.selected, isTrue);
    });

    testWidgets('land offers no delivery option', (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Yer');

      expect(find.text(AppStrings.delivery), findsNothing);
      expect(find.text('Maydon'), findsOneWidget);
    });
  });

  group('switching category', () {
    testWidgets('rebuilds the whole form around the new spec', (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Sabzavotlar');
      expect(find.text('Hajm'), findsOneWidget);

      await chooseCategory(tester, 'Qishloq texnikasi');

      expect(find.text('Nechta'), findsOneWidget);
      expect(find.text('Hajm'), findsNothing);
      // Produce's questions go with it.
      expect(find.text('Navi'), findsNothing);
    });

    testWidgets('does not carry a typed volume into an incompatible unit',
        (tester) async {
      await pumpForm(tester);
      await chooseCategory(tester, 'Sabzavotlar');

      await tester.enterText(find.byType(TextFormField).at(1), '12');
      await tester.pumpAndSettle();

      await chooseCategory(tester, 'Qishloq texnikasi');
      await tester.pumpAndSettle();

      // 12 tonnes of tractor is not a thing. The field is keyed on the
      // category, so it is rebuilt rather than reused.
      expect(find.text('12'), findsNothing);
    });
  });

  group('photos', () {
    testWidgets('offers a picker once a category is chosen', (tester) async {
      await pumpForm(tester);
      expect(find.byType(PhotoPickerField), findsNothing);

      await chooseCategory(tester, 'Sabzavotlar');

      expect(find.byType(PhotoPickerField), findsOneWidget);
      expect(find.text(AppStrings.addPhoto), findsOneWidget);
      expect(find.text(AppStrings.photosRemaining(5)), findsOneWidget);
    });

    testWidgets('a gallery pick shows thumbnails and marks the cover',
        (tester) async {
      picker.galleryResults = [photo('a'), photo('b')];

      await pumpForm(tester);
      await chooseCategory(tester, 'Sabzavotlar');

      await tester.tap(find.text(AppStrings.addPhoto));
      await tester.pumpAndSettle();
      await tester.tap(find.text(AppStrings.fromGallery));
      await tester.pumpAndSettle();

      expect(find.text(AppStrings.coverPhoto), findsOneWidget);
      expect(find.text(AppStrings.photosRemaining(3)), findsOneWidget);
    });

    testWidgets('publishing without a photo is allowed', (tester) async {
      // One bar of signal in a field is the common case; requiring a photo
      // would keep the listings that matter most off the market.
      await pumpForm(tester);
      await completeForm(tester);

      expect(find.text(AppStrings.published), findsOneWidget);
    });
  });

  group('submitting', () {
    testWidgets('an empty form reports every missing field at once',
        (tester) async {
      await pumpForm(tester);

      await tester.tap(find.text(AppStrings.publish));
      await tester.pumpAndSettle();

      expect(find.text('Kategoriyani tanlang'), findsOneWidget);
      expect(find.text(AppStrings.fixErrors), findsOneWidget);
    });

    testWidgets('a complete listing publishes and offers to open it',
        (tester) async {
      await pumpForm(tester);
      await completeForm(tester);

      expect(find.text(AppStrings.published), findsOneWidget);
      expect(find.text(AppStrings.viewListing), findsOneWidget);
    });
  });
}
