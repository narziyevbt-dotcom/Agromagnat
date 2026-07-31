import 'package:flutter/foundation.dart';

import 'category.dart';
import 'category_form.dart';
import 'draft_photo.dart';
import 'location.dart';
import 'units.dart';

/// A listing being written, before it is worth sending anywhere.
///
/// Everything is nullable because the form is filled out of order — a farmer
/// picks the category, then wanders to the price, then back for the district.
/// [validate] is what decides whether it can be submitted, and it answers in
/// the same Uzbek the API would.
@immutable
class ListingDraft {
  const ListingDraft({
    this.category,
    this.title = '',
    this.description = '',
    this.quantity,
    this.quantityUnit,
    this.price,
    this.priceUnit,
    this.region,
    this.district,
    this.minOrder,
    this.wholesalePrice,
    this.harvestDate,
    this.delivery = DeliveryOption.none,
    this.attributes = const {},
    this.photos = const [],
  });

  final ListingCategory? category;
  final String title;
  final String description;

  final num? quantity;
  final QuantityUnit? quantityUnit;
  final num? price;
  final PriceUnit? priceUnit;

  final Region? region;
  final District? district;

  final num? minOrder;
  final num? wholesalePrice;
  final DateTime? harvestDate;
  final DeliveryOption delivery;

  /// Answers to the category's own questions, keyed by the spec's keys.
  final Map<String, Object> attributes;

  /// Chosen on the device, uploaded once the listing exists. The first is the
  /// cover — it is the one the feed shows.
  final List<DraftPhoto> photos;

  CategoryFormSpec? get spec => category?.form;

  ListingDraft copyWith({
    Object? category = _unset,
    String? title,
    String? description,
    Object? quantity = _unset,
    Object? quantityUnit = _unset,
    Object? price = _unset,
    Object? priceUnit = _unset,
    Object? region = _unset,
    Object? district = _unset,
    Object? minOrder = _unset,
    Object? wholesalePrice = _unset,
    Object? harvestDate = _unset,
    DeliveryOption? delivery,
    Map<String, Object>? attributes,
    List<DraftPhoto>? photos,
  }) {
    return ListingDraft(
      category: category == _unset ? this.category : category as ListingCategory?,
      title: title ?? this.title,
      description: description ?? this.description,
      quantity: quantity == _unset ? this.quantity : quantity as num?,
      quantityUnit:
          quantityUnit == _unset ? this.quantityUnit : quantityUnit as QuantityUnit?,
      price: price == _unset ? this.price : price as num?,
      priceUnit: priceUnit == _unset ? this.priceUnit : priceUnit as PriceUnit?,
      region: region == _unset ? this.region : region as Region?,
      district: district == _unset ? this.district : district as District?,
      minOrder: minOrder == _unset ? this.minOrder : minOrder as num?,
      wholesalePrice: wholesalePrice == _unset
          ? this.wholesalePrice
          : wholesalePrice as num?,
      harvestDate:
          harvestDate == _unset ? this.harvestDate : harvestDate as DateTime?,
      delivery: delivery ?? this.delivery,
      attributes: attributes ?? this.attributes,
      photos: photos ?? this.photos,
    );
  }

  /// Switches category, dropping everything the new one does not ask.
  ///
  /// Carrying answers across is how a tractor ends up with a picking date: the
  /// API rejects it, but only after the seller has filled the whole form.
  ListingDraft withCategory(ListingCategory next) {
    final spec = next.form;

    // Units are constrained per kind. Keeping "kg" while moving to machinery
    // would leave an illegal value selected and invisible.
    final keepsQuantityUnit = spec.quantity.units.contains(quantityUnit);
    final keepsPriceUnit = spec.price.units.contains(priceUnit);

    return copyWith(
      category: next,
      quantityUnit:
          keepsQuantityUnit ? quantityUnit : spec.quantity.units.first,
      priceUnit: keepsPriceUnit ? priceUnit : spec.price.units.first,
      // A number outlives a category change only while its unit does. Moving
      // 12 t of tomatoes into machinery would silently become 12 tractors —
      // a legal value, and not remotely what the seller typed.
      quantity: keepsQuantityUnit ? quantity : null,
      price: keepsPriceUnit ? price : null,
      minOrder: spec.optional.minOrder && keepsQuantityUnit ? minOrder : null,
      harvestDate: spec.optional.harvestDate ? harvestDate : null,
      wholesalePrice:
          spec.optional.wholesalePrice && keepsPriceUnit ? wholesalePrice : null,
      delivery: spec.optional.delivery ? delivery : DeliveryOption.none,
      attributes: {
        for (final attribute in spec.attributes)
          if (attributes.containsKey(attribute.key))
            attribute.key: attributes[attribute.key]!,
      },
    );
  }

  /// Field key → Uzbek message. Empty means it can be submitted.
  ///
  /// The same rules the API enforces, checked here so a farmer on EDGE finds
  /// out before spending a round trip on it.
  Map<String, String> validate() {
    final errors = <String, String>{};
    final spec = this.spec;

    if (category == null) {
      errors['category'] = 'Kategoriyani tanlang';
    }
    if (title.trim().length < 3) {
      errors['title'] = "Sarlavha kamida 3 ta belgidan iborat bo'lishi kerak";
    }
    if (title.trim().length > 120) {
      errors['title'] = 'Sarlavha juda uzun';
    }
    if (quantity == null || quantity! <= 0) {
      errors['quantity'] = "Hajmni kiriting";
    }
    if (price == null || price! <= 0) {
      errors['price'] = 'Narxni kiriting';
    }
    if (region == null) {
      errors['region'] = 'Viloyatni tanlang';
    }
    if (district == null) {
      errors['district'] = 'Tumanni tanlang';
    }

    if (minOrder != null && quantity != null && minOrder! > quantity!) {
      // Offering a minimum lot larger than the whole stock means nobody can buy.
      errors['minOrder'] = "Eng kam partiya umumiy hajmdan katta bo'lishi mumkin emas";
    }

    if (spec != null) {
      for (final attribute in spec.requiredAttributes) {
        final value = attributes[attribute.key];
        if (value == null || (value is String && value.trim().isEmpty)) {
          errors[attribute.key] = '${attribute.labelUz}ni tanlang';
        }
      }

      for (final attribute in spec.attributes) {
        final value = attributes[attribute.key];
        if (value is num) {
          if (attribute.min != null && value < attribute.min!) {
            errors[attribute.key] = '${attribute.labelUz}: ${attribute.min} dan kam';
          }
          if (attribute.max != null && value > attribute.max!) {
            errors[attribute.key] = '${attribute.labelUz}: ${attribute.max} dan ko\'p';
          }
        }
      }
    }

    return errors;
  }

  bool get isValid => validate().isEmpty;

  static const Object _unset = Object();
}
