import '../../domain/entities/category.dart';
import '../../domain/entities/category_form.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/location.dart';
import '../../domain/entities/seller.dart';
import '../../domain/entities/units.dart';

/// JSON from the API into the entities the screens use.
///
/// Every reader here is total: a missing or malformed field degrades to a
/// sensible value rather than throwing. One bad row in a page of twenty should
/// cost the buyer that row, not the whole feed.
abstract final class ListingMapper {
  /// Money and volume arrive as strings — `"40.000"`, `"8000.00"` — because
  /// Postgres numerics lose precision through a JSON double. Parsed once here
  /// so no screen has to.
  static num? number(dynamic value) {
    if (value is num) {
      return value;
    }
    if (value is String) {
      return num.tryParse(value);
    }
    return null;
  }

  static int intOr(dynamic value, int fallback) {
    final parsed = number(value);
    return parsed?.toInt() ?? fallback;
  }

  static DateTime? date(dynamic value) {
    if (value is! String || value.isEmpty) {
      return null;
    }
    return DateTime.tryParse(value)?.toLocal();
  }

  static String? text(dynamic value) {
    if (value is! String) {
      return null;
    }
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  static Region? region(dynamic json) {
    if (json is! Map) {
      return null;
    }
    return Region(
      id: json['id'] as String,
      nameUz: json['nameUz'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
    );
  }

  static District? district(dynamic json) {
    if (json is! Map) {
      return null;
    }
    return District(
      id: json['id'] as String,
      regionId: json['regionId'] as String? ?? '',
      nameUz: json['nameUz'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
    );
  }

  static ListingCategory? category(dynamic json) {
    if (json is! Map) {
      return null;
    }
    return ListingCategory(
      id: json['id'] as String,
      nameUz: json['nameUz'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      kind: CategoryKind.fromWire(json['kind'] as String?),
      unitDefault: QuantityUnit.fromWire(json['unitDefault'] as String?),
      emoji: _emojiFor(json['icon'] as String?),
      isFeatured: json['isFeatured'] as bool? ?? false,
      sortOrder: intOr(json['sortOrder'], 0),
      // Absent on the category nested in a listing; only /categories expands it.
      form: formSpec(json['form']),
    );
  }

  static CategoryFormSpec? formSpec(dynamic json) {
    if (json is! Map) {
      return null;
    }
    return CategoryFormSpec(
      kind: CategoryKind.fromWire(json['kind'] as String?),
      quantity: _measure(json['quantity']),
      price: _measure(json['price']),
      optional: _optional(json['optional']),
      attributes: [
        for (final attribute in (json['attributes'] as List? ?? const []))
          if (attribute is Map) _attribute(attribute),
      ],
    );
  }

  static MeasureSpec _measure(dynamic json) {
    final map = json is Map ? json : const {};
    return MeasureSpec(
      labelUz: map['labelUz'] as String? ?? '',
      hintUz: map['hintUz'] as String? ?? '',
      units: [
        for (final unit in (map['units'] as List? ?? const []))
          QuantityUnit.fromWire(unit as String?),
      ],
      placeholder: map['placeholder'] as String? ?? '',
    );
  }

  static OptionalFields _optional(dynamic json) {
    final map = json is Map ? json : const {};
    return OptionalFields(
      minOrder: map['minOrder'] as bool? ?? false,
      wholesalePrice: map['wholesalePrice'] as bool? ?? false,
      harvestDate: map['harvestDate'] as bool? ?? false,
      seasonMonths: map['seasonMonths'] as bool? ?? false,
      delivery: map['delivery'] as bool? ?? false,
    );
  }

  static AttributeDef _attribute(Map<dynamic, dynamic> json) {
    return AttributeDef(
      key: json['key'] as String? ?? '',
      labelUz: json['labelUz'] as String? ?? '',
      type: AttributeType.fromWire(json['type'] as String?),
      required: json['required'] as bool? ?? false,
      options: [
        for (final option in (json['options'] as List? ?? const []))
          if (option is Map)
            AttributeOption(
              value: option['value'] as String? ?? '',
              labelUz: option['labelUz'] as String? ?? '',
            ),
      ],
      min: number(json['min']),
      max: number(json['max']),
      maxLength: number(json['maxLength'])?.toInt(),
      suffixUz: text(json['suffixUz']),
      placeholderUz: text(json['placeholderUz']),
    );
  }

  static Seller seller(dynamic json) {
    final map = json is Map ? json : const {};
    return Seller(
      id: map['id'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      name: text(map['name']),
      isVerified: map['isVerified'] as bool? ?? false,
      // Ratings are numerics too — `"4.80"`, not 4.8.
      ratingAvg: number(map['ratingAvg'])?.toDouble() ?? 0,
      ratingCount: intOr(map['ratingCount'], 0),
      salesCount: intOr(map['salesCount'], 0),
    );
  }

  static ListingPhoto photo(Map<dynamic, dynamic> json) {
    return ListingPhoto(
      id: json['id'] as String? ?? '',
      url: json['url'] as String? ?? '',
      thumbUrl: text(json['thumbUrl']),
    );
  }

  /// Null when the row is missing something a listing cannot do without.
  ///
  /// Dropping one row beats throwing away the page it arrived in — and beats
  /// showing a card with no price, which is what a lenient reader would give.
  static Listing? listing(dynamic json) {
    if (json is! Map) {
      return null;
    }

    final id = json['id'];
    final quantity = number(json['quantity']);
    final price = number(json['price']);
    final category = ListingMapper.category(json['category']);
    final region = ListingMapper.region(json['region']);
    final district = ListingMapper.district(json['district']);
    final createdAt = date(json['createdAt']);

    if (id is! String ||
        quantity == null ||
        price == null ||
        category == null ||
        region == null ||
        district == null ||
        createdAt == null) {
      return null;
    }

    return Listing(
      id: id,
      title: json['title'] as String? ?? '',
      description: text(json['description']),
      status: ListingStatus.fromWire(json['status'] as String?),
      quantity: quantity,
      quantityUnit: QuantityUnit.fromWire(json['quantityUnit'] as String?),
      price: price,
      priceUnit: QuantityUnit.fromWire(json['priceUnit'] as String?),
      minOrder: number(json['minOrder']),
      category: category,
      region: region,
      district: district,
      seller: seller(json['seller']),
      harvestDate: date(json['harvestDate']),
      delivery: DeliveryOption.fromWire(json['delivery'] as String?),
      isPromoted: json['isPromoted'] as bool? ?? false,
      viewCount: intOr(json['viewCount'], 0),
      callCount: intOr(json['callCount'], 0),
      favoriteCount: intOr(json['favoriteCount'], 0),
      isFavorite: json['isFavorite'] as bool? ?? false,
      createdAt: createdAt,
      expiresAt: date(json['expiresAt']),
      photos: [
        for (final entry in (json['photos'] as List? ?? const []))
          if (entry is Map) photo(entry),
      ],
    );
  }

  /// The API sends an icon name; the design has no icon set drawn yet, so the
  /// feed shows an emoji. Mapping it here keeps that a presentation detail
  /// rather than something the backend has to know about.
  static String? _emojiFor(String? icon) => switch (icon) {
        'apple' => '🍎',
        'carrot' => '🥕',
        'melon' => '🍉',
        'wheat' => '🌾',
        'nuts' => '🥜',
        'herb' => '🌿',
        'cow' => '🐄',
        'seed' => '🌱',
        'tractor' => '🚜',
        'tools' => '🛠',
        'land' => '🏞',
        _ => null,
      };
}
