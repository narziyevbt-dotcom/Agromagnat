import '../../domain/entities/category.dart';
import '../../domain/entities/location.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../fixtures/catalog_fixtures.dart';

/// In-memory [CatalogRepository].
///
/// The artificial latency is not decoration. Every screen built against an
/// instant repository quietly assumes data is already there, and the loading
/// and empty states only get written once something makes them appear. The
/// target user is on EDGE — those states are the common case, not the edge
/// case, so the mock makes them visible from the first run.
class MockCatalogRepository implements CatalogRepository {
  MockCatalogRepository({this.latency = const Duration(milliseconds: 250)});

  final Duration latency;

  @override
  Future<List<ListingCategory>> categories() async {
    await Future<void>.delayed(latency);
    return [...CatalogFixtures.categories]
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
  }

  @override
  Future<List<Region>> regions() async {
    await Future<void>.delayed(latency);
    return [...CatalogFixtures.regions]
      ..sort((a, b) => a.nameUz.compareTo(b.nameUz));
  }

  @override
  Future<List<District>> districts(String regionId) async {
    await Future<void>.delayed(latency);
    return CatalogFixtures.districts
        .where((district) => district.regionId == regionId)
        .toList()
      ..sort((a, b) => a.nameUz.compareTo(b.nameUz));
  }
}
