import 'package:flutter/foundation.dart';

import 'units.dart';

/// A top-level catalogue entry: Mevalar, Sabzavotlar, Poliz, Don…
///
/// [kind] drives the posting form. The full form spec the web app receives is
/// not modelled yet — the posting flow lands in a later slice, and carrying a
/// structure nothing reads would be dead weight.
@immutable
class ListingCategory {
  const ListingCategory({
    required this.id,
    required this.nameUz,
    required this.slug,
    required this.kind,
    required this.unitDefault,
    this.emoji,
    this.isFeatured = false,
    this.sortOrder = 0,
  });

  final String id;
  final String nameUz;
  final String slug;
  final CategoryKind kind;

  /// Pre-selected in the volume field when posting into this category.
  final QuantityUnit unitDefault;

  /// Stands in for the icon until the real icon set is drawn. The API sends an
  /// `icon` name; mapping it to an asset is a job for the design pass.
  final String? emoji;

  /// Featured categories get a tile on the home grid; the rest live behind
  /// "Barchasi".
  final bool isFeatured;
  final int sortOrder;

  @override
  bool operator ==(Object other) =>
      other is ListingCategory && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
