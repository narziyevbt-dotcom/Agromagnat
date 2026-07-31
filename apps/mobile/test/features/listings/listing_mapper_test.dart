import 'dart:convert';
import 'dart:io';

import 'package:agromagnat/features/listings/data/api/listing_mapper.dart';
import 'package:agromagnat/features/listings/domain/entities/units.dart';
import 'package:flutter_test/flutter_test.dart';

/// Read against responses captured from the running API, not hand-written
/// JSON. Hand-written fixtures agree with whatever the mapper already does;
/// these were pulled off `agromagnat-api.onrender.com` and carry its quirks —
/// numerics as strings, a category with no expanded form, region names with
/// their suffix.
dynamic _fixture(String name) =>
    jsonDecode(File('test/fixtures/$name').readAsStringSync());

void main() {
  group('numbers arrive as strings', () {
    test('quantity and price parse out of Postgres numerics', () {
      // "40.000" and "8000.00" — a JSON double would lose precision, so the
      // API sends them as text and the client parses once, here.
      expect(ListingMapper.number('40.000'), 40);
      expect(ListingMapper.number('8000.00'), 8000);
      expect(ListingMapper.number('0.00'), 0);
    });

    test('a plain number still works', () {
      expect(ListingMapper.number(12), 12);
      expect(ListingMapper.number(8.5), 8.5);
    });

    test('nonsense is null rather than a crash', () {
      expect(ListingMapper.number(null), isNull);
      expect(ListingMapper.number('abc'), isNull);
      expect(ListingMapper.number({}), isNull);
    });
  });

  group('a real listings page', () {
    late Map<String, dynamic> page;

    setUpAll(() => page = _fixture('listings_page.json') as Map<String, dynamic>);

    test('has the envelope the repository expects', () {
      expect(page.keys, containsAll(['items', 'hasMore', 'nextCursor']));
    });

    test('maps the row the API actually returns', () {
      final listing = ListingMapper.listing((page['items'] as List).first);

      expect(listing, isNotNull);
      expect(listing!.title, isNotEmpty);
      expect(listing.quantity, 40);
      expect(listing.quantityUnit, QuantityUnit.t);
      expect(listing.price, 8000);
      expect(listing.priceUnit, QuantityUnit.kg);
      expect(listing.region.nameUz, isNotEmpty);
      expect(listing.district.nameUz, isNotEmpty);
      expect(listing.seller.phone, startsWith('+998'));
    });

    test('the nested category has no form spec, and that is fine', () {
      final listing = ListingMapper.listing((page['items'] as List).first);

      // GET /listings returns the category row unexpanded. Only the posting
      // form needs a spec, and it gets its categories from /categories.
      expect(listing!.category.form, isNull);
      expect(listing.category.slug, isNotEmpty);
    });

    test('a rating of "0.00" reads as zero, not as text', () {
      final listing = ListingMapper.listing((page['items'] as List).first);
      expect(listing!.seller.ratingAvg, 0);
      expect(listing.seller.hasRating, isFalse);
    });
  });

  group('a real categories response', () {
    late List<dynamic> categories;

    setUpAll(() => categories = _fixture('categories.json') as List<dynamic>);

    test('carries the form spec the posting screen renders', () {
      final category = ListingMapper.category(categories.first);

      expect(category!.form, isNotNull);
      expect(category.form!.quantity.units, isNotEmpty);
      expect(category.form!.price.units, isNotEmpty);
    });

    test('maps the icon name onto something the feed can draw', () {
      // The API sends "apple"; there is no icon set drawn yet, so the feed
      // shows an emoji and the mapping stays a client concern.
      final category = ListingMapper.category(categories.first);
      expect(category!.emoji, isNotNull);
    });

    test('produce asks for a picking date, and says so in its spec', () {
      final produce = [
        for (final entry in categories) ListingMapper.category(entry),
      ].firstWhere((category) => category!.form?.kind == CategoryKind.produce);

      expect(produce!.form!.optional.harvestDate, isTrue);
    });
  });

  group('a malformed row', () {
    test('is dropped rather than throwing', () {
      // One bad row in a page of twenty should cost the buyer that row, not
      // the whole feed.
      expect(ListingMapper.listing(null), isNull);
      expect(ListingMapper.listing('not a listing'), isNull);
      expect(ListingMapper.listing(const {'id': 'x'}), isNull);
    });

    test('needs a price to be worth showing', () {
      final page = _fixture('listings_page.json') as Map<String, dynamic>;
      final row = Map<String, dynamic>.from((page['items'] as List).first as Map)
        ..remove('price');

      // A card with no price is worse than no card.
      expect(ListingMapper.listing(row), isNull);
    });
  });

  group('unknown values from a newer backend', () {
    test('degrade instead of throwing', () {
      // A build one release behind must keep working when the API grows a
      // value it has never heard of.
      expect(QuantityUnit.fromWire('parsec'), QuantityUnit.kg);
      expect(CategoryKind.fromWire('spaceship'), CategoryKind.produce);
      expect(ListingStatus.fromWire('quantum'), ListingStatus.active);
      expect(DeliveryOption.fromWire('teleport'), DeliveryOption.none);
    });
  });
}
