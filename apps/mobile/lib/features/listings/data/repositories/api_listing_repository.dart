import 'package:dio/dio.dart';

import '../../../../core/cache/json_cache.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/pagination/paginated.dart';
import '../../domain/entities/draft_photo.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/listing_draft.dart';
import '../../domain/repositories/listing_repository.dart';
import '../api/listing_mapper.dart';

/// The real feed, search and posting.
///
/// Caching lives here rather than in a decorator because this is the only
/// layer that sees the wire format. A decorator would have to serialise
/// entities back to JSON, which means a second mapper written in reverse —
/// and the day the two disagree, a listing reads back wrong from disk with
/// nothing to catch it. Storing the raw response keeps one mapper, one
/// direction.
class ApiListingRepository implements ListingRepository {
  ApiListingRepository(this._client, {this.cache});

  final ApiClient _client;

  /// Not private: a named parameter cannot carry an underscore, and an
  /// initializer written only to add one is noise.
  final JsonCache? cache;

  /// The unfiltered first page — the screen a farmer opens the app to.
  ///
  /// Filtered searches are not cached: the key space is unbounded, and a
  /// buyer who filtered to "Samarqand, pomidor, under 10 000" expects an
  /// answer to that question, not a remembered one.
  static const String feedKey = 'feed';

  static String _detailKey(String id) => 'listing_$id';

  static bool _isCacheable(ListingQuery query) =>
      query.isUnfiltered &&
      query.cursor == null &&
      query.sort == ListingSort.newest;

  @override
  Future<Paginated<Listing>> search(ListingQuery query) async {
    try {
      return await _fetchPage(query);
    } on ApiException catch (error) {
      // Only a dead network falls back. A 500 or a 400 means the server
      // answered, and showing yesterday's feed as though nothing happened
      // would hide a real fault.
      final cached = error.status == 0 ? cachedFeed(query) : null;
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }

  /// The last stored feed, if this query is the one that gets cached.
  ///
  /// Public so the home screen can paint it before the request has even been
  /// sent — waiting fifteen seconds for a connect timeout to expire, then
  /// showing what was on disk all along, is the worst of both.
  Paginated<Listing>? cachedFeed(ListingQuery query) {
    if (!_isCacheable(query) || cache == null) {
      return null;
    }
    final entry = cache!.read<List<Listing>>(
      feedKey,
      (json) => [
        for (final row in (json as List)) ?ListingMapper.listing(row),
      ],
    );
    if (entry == null || entry.value.isEmpty) {
      return null;
    }
    // No cursor: paging on from a cached page would ask the server for the
    // continuation of something it never sent.
    return Paginated<Listing>(items: entry.value, cachedAt: entry.cachedAt);
  }

  Future<Paginated<Listing>> _fetchPage(ListingQuery query) async {
    dynamic raw;

    final page = await _client.get(
      '/listings',
      query: {
        'q': query.text,
        'categoryId': query.categoryId,
        'regionId': query.regionId,
        'districtId': query.districtId,
        'priceMin': query.minPrice,
        'priceMax': query.maxPrice,
        'quantityMin': query.minQuantity,
        'sort': _sortWire(query.sort),
        'cursor': query.cursor,
        'limit': query.limit,
      },
      decode: (body) {
        raw = body;
        final map = body is Map ? body : const {};
        return Paginated<Listing>(
          items: [
            // A row the mapper cannot make sense of is dropped rather than
            // failing the page it arrived in.
            for (final entry in (map['items'] as List? ?? const []))
              ?ListingMapper.listing(entry),
          ],
          nextCursor: ListingMapper.text(map['nextCursor']),
        );
      },
    );

    // Awaited rather than fired off. A SharedPreferences write is a few
    // milliseconds against a request that just took hundreds, and leaving it
    // in flight means the page is only sometimes there on the next launch —
    // a cache that works most of the time is the hardest kind to trust.
    if (_isCacheable(query) && raw is Map) {
      await cache?.write(feedKey, (raw as Map)['items'] ?? const []);
    }

    return page;
  }

  @override
  Future<Listing> byId(String id) async {
    try {
      dynamic raw;
      final listing = await _client.get(
        '/listings/$id',
        decode: (body) {
          raw = body;
          return ListingMapper.listing(body);
        },
      );
      if (listing == null) {
        throw ListingNotFoundException(id);
      }
      await cache?.write(_detailKey(id), raw);
      return listing;
    } on ApiException catch (error) {
      if (error.isNotFound) {
        // Gone for good — drop it rather than keep serving a deleted listing.
        await cache?.remove(_detailKey(id));
        throw ListingNotFoundException(id);
      }

      // A listing the buyer opened once should still open in a dead spot.
      // That is where they are standing when they decide to call.
      if (error.status == 0) {
        final cached = cache
            ?.read<Listing?>(_detailKey(id), ListingMapper.listing)
            ?.value;
        if (cached != null) {
          return cached;
        }
      }
      rethrow;
    }
  }

  @override
  Future<void> setFavorite(String id, {required bool saved}) async {
    // Two endpoints, both 204. Nothing comes back, which is why the UI holds
    // the state optimistically rather than waiting to be told.
    if (saved) {
      await _client.post<void>('/listings/$id/favorite', decode: (_) {});
    } else {
      await _client.delete('/listings/$id/favorite');
    }
  }

  @override
  Future<Listing> create(ListingDraft draft) => postBody(bodyFor(draft));

  /// Exactly what `POST /listings` takes.
  ///
  /// Named and public because the outbox stores this rather than the draft: a
  /// queued listing has to be replayable without looking its category up
  /// again, and this is already the shape the server validates.
  static Map<String, dynamic> bodyFor(ListingDraft draft) => {
        'title': draft.title.trim(),
        if (draft.description.trim().isNotEmpty)
          'description': draft.description.trim(),
        'categoryId': draft.category!.id,
        'quantity': draft.quantity,
        'quantityUnit': draft.quantityUnit!.wire,
        'price': draft.price,
        'priceUnit': draft.priceUnit!.wire,
        'regionId': draft.region!.id,
        'districtId': draft.district!.id,
        if (draft.minOrder != null) 'minOrder': draft.minOrder,
        if (draft.wholesalePrice != null) 'wholesalePrice': draft.wholesalePrice,
        if (draft.harvestDate != null)
          'harvestDate': _dateOnly(draft.harvestDate!),
        'delivery': draft.delivery.wire,
        if (draft.attributes.isNotEmpty) 'attributes': draft.attributes,
      };

  /// Posts a prepared body — a fresh submit or one replayed from the outbox.
  Future<Listing> postBody(Map<String, dynamic> body) async {
    try {
      final listing = await _client.post(
        '/listings',
        body: body,
        decode: ListingMapper.listing,
      );

      if (listing == null) {
        throw const ApiException(0, "E'lon joylandi, lekin javob o'qilmadi");
      }
      return listing;
    } on ApiException catch (error) {
      if (error.fieldErrors.isNotEmpty) {
        throw ListingValidationException(error.fieldErrors);
      }
      rethrow;
    }
  }

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) async {
    if (photos.isEmpty) {
      return byId(listingId);
    }

    // One request per photo. The API accepts all five at once, but a single
    // multipart body that dies at 90% on EDGE takes every photo with it —
    // and the seller has no way to tell which ones made it.
    for (final photo in photos) {
      final form = FormData.fromMap({
        'files': [await MultipartFile.fromFile(photo.path)],
      });
      await _client.upload<void>(
        '/listings/$listingId/photos',
        form,
        decode: (_) {},
      );
    }

    return byId(listingId);
  }

  @override
  Future<void> removePhoto(String listingId, String photoId) async {
    await _client.delete('/listings/$listingId/photos/$photoId');
    // The cached detail still lists it, and it would render as a broken image
    // for whoever opens the listing offline next.
    await cache?.remove(_detailKey(listingId));
  }

  @override
  Future<Paginated<Listing>> mine({String? cursor, int limit = 20}) {
    // Not cached. It is the seller's own list, it changes because of something
    // they just did, and a stale copy here reads as "my edit did not save".
    return _client.get(
      '/listings/me',
      query: {'cursor': cursor, 'limit': limit},
      decode: (body) {
        final map = body is Map ? body : const {};
        return Paginated<Listing>(
          items: [
            for (final entry in (map['items'] as List? ?? const []))
              ?ListingMapper.listing(entry),
          ],
          nextCursor: ListingMapper.text(map['nextCursor']),
        );
      },
    );
  }

  @override
  Future<Listing> update(String id, ListingDraft draft) async {
    try {
      final listing = await _client.patch(
        '/listings/$id',
        body: bodyFor(draft),
        decode: ListingMapper.listing,
      );
      if (listing == null) {
        throw ListingNotFoundException(id);
      }
      await cache?.remove(_detailKey(id));
      return listing;
    } on ApiException catch (error) {
      if (error.fieldErrors.isNotEmpty) {
        throw ListingValidationException(error.fieldErrors);
      }
      rethrow;
    }
  }

  @override
  Future<Listing> markSold(String id) async {
    final listing = await _client.post(
      '/listings/$id/sold',
      decode: ListingMapper.listing,
    );
    if (listing == null) {
      throw ListingNotFoundException(id);
    }
    // Dropped rather than rewritten: the cached copy would otherwise keep
    // showing "active" to whoever opens it offline, including the seller who
    // just marked it sold.
    await cache?.remove(_detailKey(id));
    return listing;
  }

  @override
  Future<Listing> renew(String id) async {
    final listing = await _client.post(
      '/listings/$id/renew',
      decode: ListingMapper.listing,
    );
    if (listing == null) {
      throw ListingNotFoundException(id);
    }
    await cache?.remove(_detailKey(id));
    return listing;
  }

  @override
  Future<void> remove(String id) async {
    await _client.delete('/listings/$id');
    await cache?.remove(_detailKey(id));
  }

  static String _sortWire(ListingSort sort) => switch (sort) {
        ListingSort.newest => 'newest',
        ListingSort.priceAsc => 'cheapest',
        ListingSort.priceDesc => 'expensive',
      };

  /// The column is a date, and sending an instant makes the stored day depend
  /// on the phone's timezone.
  static String _dateOnly(DateTime value) =>
      '${value.year.toString().padLeft(4, '0')}-'
      '${value.month.toString().padLeft(2, '0')}-'
      '${value.day.toString().padLeft(2, '0')}';
}
