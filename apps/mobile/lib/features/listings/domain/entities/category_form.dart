import 'package:flutter/foundation.dart';

import 'units.dart';

/// One category-specific question, as the API describes it.
///
/// The client knows how to draw a select, a number and a text box, and nothing
/// about what a tractor is. Adding a field is a backend change that reaches
/// both clients on the next API deploy rather than the next store review.
@immutable
class AttributeDef {
  const AttributeDef({
    required this.key,
    required this.labelUz,
    required this.type,
    required this.required,
    this.options = const [],
    this.min,
    this.max,
    this.maxLength,
    this.suffixUz,
    this.placeholderUz,
  });

  final String key;
  final String labelUz;
  final AttributeType type;
  final bool required;

  /// Populated for [AttributeType.select] only.
  final List<AttributeOption> options;

  final num? min;
  final num? max;
  final int? maxLength;

  /// Shown inside the input after the value — "soat", "yil".
  final String? suffixUz;
  final String? placeholderUz;
}

enum AttributeType {
  select('select'),
  number('number'),
  text('text');

  const AttributeType(this.wire);

  final String wire;

  static AttributeType fromWire(String? value) {
    return AttributeType.values.firstWhere(
      (type) => type.wire == value,
      // A field type this build has never heard of renders as a text box
      // rather than disappearing. The user can still answer it.
      orElse: () => AttributeType.text,
    );
  }
}

@immutable
class AttributeOption {
  const AttributeOption({required this.value, required this.labelUz});

  final String value;
  final String labelUz;
}

/// Which of the always-present optional fields this kind actually asks for.
@immutable
class OptionalFields {
  const OptionalFields({
    this.minOrder = false,
    this.wholesalePrice = false,
    this.harvestDate = false,
    this.seasonMonths = false,
    this.delivery = false,
  });

  final bool minOrder;
  final bool wholesalePrice;
  final bool harvestDate;
  final bool seasonMonths;
  final bool delivery;
}

/// The quantity or price question: what to call it, which units are legal.
@immutable
class MeasureSpec {
  const MeasureSpec({
    required this.labelUz,
    required this.hintUz,
    required this.units,
    required this.placeholder,
  });

  final String labelUz;
  final String hintUz;
  final List<QuantityUnit> units;
  final String placeholder;

  /// Machinery is counted in `dona` and land measured in `ga`, full stop.
  /// A select offering one option is a control that looks interactive and
  /// is not, so the form renders it locked instead.
  bool get isLocked => units.length == 1;
}

/// The complete description of a posting form, one per category kind.
///
/// Comes from the API and is rendered as given. Hardcoding a per-category form
/// in the client is the thing this type exists to prevent: the backend would
/// then validate against one shape while the app collected another.
@immutable
class CategoryFormSpec {
  const CategoryFormSpec({
    required this.kind,
    required this.quantity,
    required this.price,
    required this.optional,
    this.attributes = const [],
  });

  final CategoryKind kind;
  final MeasureSpec quantity;
  final MeasureSpec price;
  final OptionalFields optional;
  final List<AttributeDef> attributes;

  Iterable<AttributeDef> get requiredAttributes =>
      attributes.where((attribute) => attribute.required);
}
