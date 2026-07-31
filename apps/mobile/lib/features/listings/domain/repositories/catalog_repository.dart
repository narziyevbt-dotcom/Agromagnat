import '../entities/category.dart';
import '../entities/location.dart';

/// Reference data: categories and the region/district tree.
///
/// Kept apart from [ListingRepository] because its lifetime is completely
/// different — categories change a few times a year and are cached hard, while
/// the feed is refetched constantly.
abstract interface class CatalogRepository {
  Future<List<ListingCategory>> categories();

  Future<List<Region>> regions();

  /// Districts of one region. Fetching all 200-odd at once wastes bytes on a
  /// connection that is already the bottleneck.
  Future<List<District>> districts(String regionId);
}
