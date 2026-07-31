import 'package:agromagnat/features/add_listing/presentation/providers/draft_controller.dart';
import 'package:agromagnat/features/ai/data/dictation.dart';
import 'package:agromagnat/features/ai/data/mock_ai_repository.dart';
import 'package:agromagnat/features/ai/domain/entities/ai_draft.dart';
import 'package:agromagnat/features/ai/domain/repositories/ai_repository.dart';
import 'package:agromagnat/features/ai/presentation/providers/composer_controller.dart';
import 'package:agromagnat/features/listings/data/fixtures/catalog_fixtures.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';
import '../add_listing/photos_test.dart' show FakePhotoPicker;

/// Stands in for the platform recogniser, which does not exist under
/// `flutter test`.
class FakeDictation implements Dictation {
  FakeDictation({this.available = true});

  bool available;
  bool _listening = false;

  void Function(String, bool)? _onResult;
  void Function()? _onDone;

  @override
  bool get isListening => _listening;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<void> start({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
  }) async {
    _listening = true;
    _onResult = onResult;
    _onDone = onDone;
  }

  @override
  Future<void> stop() async => _listening = false;

  /// Feeds a partial transcript, the way the recogniser refines a sentence.
  void say(String transcript, {bool isFinal = false}) =>
      _onResult?.call(transcript, isFinal);

  void finish() {
    _listening = false;
    _onDone?.call();
  }
}

void main() {
  late FakeDictation dictation;
  late ComposerController composer;

  setUp(() {
    dictation = FakeDictation();
    composer = ComposerController(
      MockAiRepository(latency: Duration.zero),
      dictation,
    );
  });

  group('dictation', () {
    test('partial results replace rather than append', () async {
      await composer.toggleDictation();

      // The recogniser hands back the whole sentence each time, refined —
      // appending would produce "12 tonna12 tonna pomidor".
      dictation.say('12 tonna');
      expect(composer.state.text, '12 tonna');

      dictation.say('12 tonna pomidor');
      expect(composer.state.text, '12 tonna pomidor');
    });

    test('clears what was there before listening starts', () async {
      composer.setText('eski gap');
      await composer.toggleDictation();

      expect(composer.state.text, '');
      expect(composer.state.listening, isTrue);
    });

    test('stops when the recogniser says it is done', () async {
      await composer.toggleDictation();
      dictation.say('pomidor', isFinal: true);
      dictation.finish();

      expect(composer.state.listening, isFalse);
      expect(composer.state.text, 'pomidor');
    });

    test('tapping again stops it', () async {
      await composer.toggleDictation();
      expect(composer.state.listening, isTrue);

      await composer.toggleDictation();
      expect(composer.state.listening, isFalse);
    });
  });

  group('requesting a draft', () {
    test('needs something worth sending', () async {
      composer.setText('12');
      expect(composer.state.canDraft, isFalse);
      expect(await composer.requestDraft(), isNull);

      composer.setText('12 tonna pomidor');
      expect(composer.state.canDraft, isTrue);
    });

    test('will not fire mid-dictation', () async {
      await composer.toggleDictation();
      dictation.say('12 tonna pomidor');

      // The sentence is still being spoken; drafting half of it wastes the
      // request and fills the form with a fragment.
      expect(composer.state.canDraft, isFalse);
    });

    test('fills from the sentence and says what is missing', () async {
      composer.setText("12 tonna pomidor, kilosi 14 ming so'm");
      final draft = await composer.requestDraft();

      expect(draft, isNotNull);
      expect(draft!.categorySlug, 'sabzavotlar');
      expect(draft.quantity, 12);
      expect(draft.price, 14000);
      // Location is never in the sentence, so it is always still needed.
      expect(draft.missingUz, contains('Viloyat va tumanni tanlang'));
    });

    test('reports rather than pretends when nothing can be extracted',
        () async {
      composer.setText('assalomu alaykum qalaysiz');
      final draft = await composer.requestDraft();

      expect(draft, isNull);
      expect(composer.state.error, isNotNull);
    });

    test('a rate limit shows the API message verbatim', () async {
      final limited = ComposerController(_RateLimited(), dictation);
      limited.setText('12 tonna pomidor');

      expect(await limited.requestDraft(), isNull);
      expect(limited.state.error, "Soatlik limit tugadi");
    });

    test('a dead assistant says typing still works', () async {
      final broken = ComposerController(_Broken(), dictation);
      broken.setText('12 tonna pomidor');

      expect(await broken.requestDraft(), isNull);
      expect(broken.state.error, contains("qo'lda"));
    });
  });

  group('applying a draft to the form', () {
    late DraftController form;

    setUp(() {
      form = DraftController(
        MockListingRepository(now: testNow, latency: Duration.zero),
        FakePhotoPicker(),
      );
    });

    test('fills category, title, volume and price', () async {
      composer.setText("12 tonna pomidor, kilosi 14 ming so'm");
      form.applyAiDraft((await composer.requestDraft())!);

      expect(form.state.draft.category?.slug, 'sabzavotlar');
      expect(form.state.draft.title, 'Pomidor');
      expect(form.state.draft.quantity, 12);
      expect(form.state.draft.quantityUnit, QuantityUnit.t);
      expect(form.state.draft.price, 14000);
      expect(form.state.draft.priceUnit, QuantityUnit.kg);
    });

    test('does not overwrite what the seller already typed', () async {
      form.setTitle('Mening sarlavham');

      composer.setText("12 tonna pomidor, kilosi 14 ming so'm");
      form.applyAiDraft((await composer.requestDraft())!);

      // Having the assistant wipe your typing is worse than having it fill
      // nothing.
      expect(form.state.draft.title, 'Mening sarlavham');
      expect(form.state.draft.quantity, 12);
    });

    test('drops a unit the category does not allow', () {
      // The sentence says kilos; the category is machinery, which is counted
      // in dona. The spec wins — the same guard the backend applies.
      form.applyAiDraft(
        const AiDraft(
          categorySlug: 'texnika',
          title: 'Traktor MTZ-82',
          quantity: 1,
          quantityUnit: 'kg',
          price: 185000000,
          priceUnit: 'kg',
        ),
      );

      expect(form.state.draft.category?.slug, 'texnika');
      expect(form.state.draft.quantityUnit, QuantityUnit.dona);
      expect(form.state.draft.priceUnit, QuantityUnit.dona);
    });

    test('drops an attribute the category never declared', () {
      form.applyAiDraft(
        const AiDraft(
          categorySlug: 'sabzavotlar',
          title: 'Pomidor',
          attributes: {'condition': 'used', 'grade': 'first'},
        ),
      );

      // `condition` belongs to machinery. Dropping it here beats having the
      // listing rejected at publish time.
      expect(form.state.draft.attributes, {'grade': 'first'});
    });

    test('ignores a harvest date on a category that has none', () {
      form.applyAiDraft(
        AiDraft(
          categorySlug: 'texnika',
          title: 'Traktor',
          harvestDate: DateTime(2026, 7, 20),
        ),
      );

      expect(form.state.draft.harvestDate, isNull);
    });

    test('an unknown category slug leaves the form alone', () {
      form.applyAiDraft(const AiDraft(categorySlug: 'kakao', title: 'Kakao'));

      expect(form.state.draft.category, isNull);
    });

    test('the draft never publishes anything', () async {
      composer.setText("12 tonna pomidor, kilosi 14 ming so'm");
      form.applyAiDraft((await composer.requestDraft())!);

      // Filled, but not posted, and not even valid yet — the location is
      // still missing and publishing stays a deliberate act.
      expect(form.state.published, isNull);
      expect(form.state.draft.isValid, isFalse);
      expect(form.state.draft.validate().keys, contains('region'));
    });
  });

  test('the fixtures carry every slug the lexicon can return', () {
    // A slug the lexicon suggests but the catalogue does not have is a
    // category the form can never select.
    const suggestible = [
      'sabzavotlar',
      'mevalar',
      'poliz',
      'don',
      'texnika',
      'xizmatlar',
      'yer',
    ];
    final slugs = CatalogFixtures.categories.map((c) => c.slug).toSet();

    for (final slug in suggestible) {
      expect(slugs, contains(slug), reason: '$slug has no category');
    }
  });
}

class _RateLimited implements AiRepository {
  @override
  Future<AiDraft> draftListing(String text) =>
      Future.error(const AiRateLimitException('Soatlik limit tugadi'));
}

class _Broken implements AiRepository {
  @override
  Future<AiDraft> draftListing(String text) =>
      Future.error(Exception('connection reset'));
}
