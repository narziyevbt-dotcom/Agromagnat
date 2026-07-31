import 'package:agromagnat/features/listings/data/fixtures/catalog_fixtures.dart';
import 'package:agromagnat/features/listings/domain/entities/category.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:flutter_test/flutter_test.dart';

/// The draft holds the rules that decide what a category asks and what counts
/// as complete. They are checked here rather than only through the screen,
/// because "a tractor must never be asked for a picking date" is a product
/// rule, not a layout detail.
void main() {
  ListingCategory categoryOf(String id) => CatalogFixtures.categoryById(id);

  final produce = categoryOf('cat-sabzavot');
  final machinery = categoryOf('cat-texnika');
  final land = categoryOf('cat-yer');

  /// A draft that would pass validation, for tests that want to break one rule
  /// at a time.
  ListingDraft complete({ListingCategory? category}) {
    final chosen = category ?? produce;
    return const ListingDraft()
        .withCategory(chosen)
        .copyWith(
          title: 'Urgut pomidori',
          quantity: 12,
          price: 9500,
          region: CatalogFixtures.regions.first,
          district: CatalogFixtures.districts.first,
        );
  }

  group('the spec decides which questions get asked', () {
    test('produce is asked for a picking date, machinery is not', () {
      expect(produce.form.optional.harvestDate, isTrue);
      expect(machinery.form.optional.harvestDate, isFalse);
    });

    test('machinery is counted in dona and nothing else', () {
      expect(machinery.form.quantity.units, [QuantityUnit.dona]);
      expect(machinery.form.quantity.isLocked, isTrue);
    });

    test('land is measured in hectares and offers no delivery', () {
      expect(land.form.quantity.units, [QuantityUnit.ga]);
      expect(land.form.optional.delivery, isFalse);
    });

    test('produce offers a real choice of unit, so nothing is locked', () {
      expect(produce.form.quantity.units.length, greaterThan(1));
      expect(produce.form.quantity.isLocked, isFalse);
    });

    test('only machinery and land require an attribute', () {
      expect(machinery.form.requiredAttributes.map((a) => a.key), contains('condition'));
      expect(land.form.requiredAttributes.map((a) => a.key), contains('tenure'));
      expect(produce.form.requiredAttributes, isEmpty);
    });
  });

  group('changing category', () {
    test('drops a picking date the new category does not ask for', () {
      final draft = complete().copyWith(harvestDate: DateTime(2026, 7, 20));
      expect(draft.harvestDate, isNotNull);

      final moved = draft.withCategory(machinery);

      // Carrying it across is how a tractor ends up with a picking date: the
      // API rejects it, but only after the whole form has been filled in.
      expect(moved.harvestDate, isNull);
    });

    test('replaces a unit the new category does not allow', () {
      final draft = complete().copyWith(quantityUnit: QuantityUnit.t);
      final moved = draft.withCategory(machinery);

      expect(moved.quantityUnit, QuantityUnit.dona);
      expect(moved.priceUnit, QuantityUnit.dona);
    });

    test('keeps a unit that is still legal', () {
      final draft = complete().copyWith(quantityUnit: QuantityUnit.kg);
      final moved = draft.withCategory(categoryOf('cat-meva'));

      expect(moved.quantityUnit, QuantityUnit.kg);
    });

    test('drops attributes the new category never heard of', () {
      final draft = complete(category: machinery)
          .copyWith(attributes: {'condition': 'used', 'year': 2018});

      final moved = draft.withCategory(produce);

      expect(moved.attributes, isEmpty);
    });

    test('drops a minimum lot when the new category does not offer one', () {
      final draft = complete().copyWith(minOrder: 2);
      expect(draft.withCategory(machinery).minOrder, isNull);
    });

    test('keeps the title and the location, which every category asks', () {
      final draft = complete().copyWith(title: 'Traktor');
      final moved = draft.withCategory(machinery);

      expect(moved.title, 'Traktor');
      expect(moved.region, isNotNull);
      expect(moved.district, isNotNull);
    });
  });

  group('validation', () {
    test('a complete produce draft passes', () {
      expect(complete().validate(), isEmpty);
      expect(complete().isValid, isTrue);
    });

    test('names every missing required field at once', () {
      final errors = const ListingDraft().validate();

      // All of them, not the first — a farmer should not discover the form
      // one rejection at a time on a connection that charges per request.
      expect(
        errors.keys,
        containsAll(['category', 'title', 'quantity', 'price', 'region', 'district']),
      );
    });

    test('rejects a zero or negative quantity', () {
      expect(complete().copyWith(quantity: 0).validate(), contains('quantity'));
      expect(complete().copyWith(price: 0).validate(), contains('price'));
    });

    test('rejects a title too short to mean anything', () {
      expect(complete().copyWith(title: 'ab').validate(), contains('title'));
    });

    test('rejects a minimum lot larger than the whole stock', () {
      // Nobody could buy it.
      final draft = complete().copyWith(quantity: 5, minOrder: 10);
      expect(draft.validate(), contains('minOrder'));
    });

    test('accepts a minimum lot inside the stock', () {
      expect(complete().copyWith(quantity: 12, minOrder: 2).validate(), isEmpty);
    });

    test('demands the attributes the category marks required', () {
      final draft = complete(category: machinery);

      expect(draft.validate(), contains('condition'));

      final answered = draft.copyWith(attributes: {'condition': 'used'});
      expect(answered.validate(), isEmpty);
    });

    test('enforces an attribute range', () {
      final draft = complete(category: machinery)
          .copyWith(attributes: {'condition': 'used', 'year': 1900});

      expect(draft.validate(), contains('year'));
    });

    test('land needs both of its required attributes', () {
      final draft = complete(category: land);
      final errors = draft.validate();

      expect(errors, contains('tenure'));
      expect(errors, contains('irrigation'));

      final answered = draft.copyWith(
        attributes: {'tenure': 'lease', 'irrigation': 'yes'},
      );
      expect(answered.validate(), isEmpty);
    });
  });
}
