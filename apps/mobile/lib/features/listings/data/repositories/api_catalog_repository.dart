import '../../../../core/network/api_client.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/location.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../api/listing_mapper.dart';

/// Categories and the region tree, from the API.
class ApiCatalogRepository implements CatalogRepository {
  ApiCatalogRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<ListingCategory>> categories() {
    return _client.get(
      '/categories',
      decode: (body) {
        final list = body is List ? body : const [];
        return [
          for (final entry in list) ?ListingMapper.category(entry),
        ]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      },
    );
  }

  @override
  Future<List<Region>> regions() {
    return _client.get(
      '/regions',
      decode: (body) {
        final list = body is List ? body : const [];
        return [
          for (final entry in list) ?ListingMapper.region(entry),
        ]..sort((a, b) => a.nameUz.compareTo(b.nameUz));
      },
    );
  }

  @override
  Future<List<District>> districts(String regionId) {
    return _client.get(
      '/regions/$regionId/districts',
      decode: (body) {
        final list = body is List ? body : const [];
        return [
          for (final entry in list) ?ListingMapper.district(entry),
        ]..sort((a, b) => a.nameUz.compareTo(b.nameUz));
      },
    );
  }
}
