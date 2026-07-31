import 'package:flutter/foundation.dart';

import 'category_form.dart';
import 'units.dart';

/// A top-level catalogue entry: Mevalar, Sabzavotlar, Poliz, Don…
///
/// [form] is expanded from [kind] by the API on every read, and is what the
/// posting screen renders. The client never decides which questions a category
/// asks — do that and the backend ends up validating one shape while the app
/// collects another.
@immutable
class ListingCategory {
  const ListingCategory({
    required this.id,
    required this.nameUz,
    required this.slug,
    required this.kind,
    required this.unitDefault,
    required this.form,
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

  /// Which questions this category's posting form asks.
  final CategoryFormSpec form;

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
