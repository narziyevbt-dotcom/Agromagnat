import '../../../../core/cache/json_cache.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/location.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../api/listing_mapper.dart';

/// Categories and the region tree, from the API.
///
/// Cached without a TTL. Categories and viloyats change a few times a year,
/// and the cost of showing a slightly old list is a category missing from a
/// grid — while the cost of not caching them is a posting form that cannot be
/// opened at all without signal.
class ApiCatalogRepository implements CatalogRepository {
  ApiCatalogRepository(this._client, {this.cache});

  final ApiClient _client;

  /// Not private: a named parameter cannot carry an underscore.
  final JsonCache? cache;

  @override
  Future<List<ListingCategory>> categories() {
    return _cached(
      path: '/categories',
      key: 'categories',
      decode: (json) => [
        for (final entry in (json as List)) ?ListingMapper.category(entry),
      ]..sort((a, b) => a.sortOrder.compareTo(b.sortOrder)),
    );
  }

  @override
  Future<List<Region>> regions() {
    return _cached(
      path: '/regions',
      key: 'regions',
      decode: (json) => [
        for (final entry in (json as List)) ?ListingMapper.region(entry),
      ]..sort((a, b) => a.nameUz.compareTo(b.nameUz)),
    );
  }

  @override
  Future<List<District>> districts(String regionId) {
    return _cached(
      path: '/regions/$regionId/districts',
      key: 'districts_$regionId',
      decode: (json) => [
        for (final entry in (json as List)) ?ListingMapper.district(entry),
      ]..sort((a, b) => a.nameUz.compareTo(b.nameUz)),
    );
  }

  /// Fetch, store the raw body, and fall back to it when the network is dead.
  ///
  /// Only a dead network falls back — a 500 means the server answered, and
  /// papering over that with an old list hides a real fault.
  Future<T> _cached<T>({
    required String path,
    required String key,
    required T Function(dynamic json) decode,
  }) async {
    try {
      dynamic raw;
      final value = await _client.get(
        path,
        decode: (body) {
          raw = body;
          return decode(body is List ? body : const []);
        },
      );
      await cache?.write(key, raw);
      return value;
    } on ApiException catch (error) {
      if (error.status == 0) {
        final entry = cache?.read<T>(key, decode);
        if (entry != null) {
          return entry.value;
        }
      }
      rethrow;
    }
  }
}
