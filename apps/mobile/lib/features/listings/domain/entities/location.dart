import 'package:flutter/foundation.dart';

/// A viloyat. Uzbekistan has 14, so the whole list is small enough to hold in
/// memory and filter locally rather than round-tripping a search.
@immutable
class Region {
  const Region({
    required this.id,
    required this.nameUz,
    required this.slug,
  });

  final String id;
  final String nameUz;
  final String slug;

  @override
  bool operator ==(Object other) =>
      other is Region && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// A tuman, always shown after its region as "Viloyat · Tuman".
@immutable
class District {
  const District({
    required this.id,
    required this.regionId,
    required this.nameUz,
    required this.slug,
  });

  final String id;
  final String regionId;
  final String nameUz;
  final String slug;

  @override
  bool operator ==(Object other) =>
      other is District && other.id == id;

  @override
  int get hashCode => id.hashCode;
}
