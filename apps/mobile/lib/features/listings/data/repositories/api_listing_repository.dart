import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/pagination/paginated.dart';
import '../../domain/entities/draft_photo.dart';
import '../../domain/entities/listing.dart';
import '../../domain/entities/listing_draft.dart';
import '../../domain/repositories/listing_repository.dart';
import '../api/listing_mapper.dart';

/// The real feed, search and posting.
class ApiListingRepository implements ListingRepository {
  ApiListingRepository(this._client);

  final ApiClient _client;

  @override
  Future<Paginated<Listing>> search(ListingQuery query) async {
    return _client.get(
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
        final map = body is Map ? body : const {};
        return Paginated<Listing>(
          items: [
            for (final entry in (map['items'] as List? ?? const []))
              // A row the mapper cannot make sense of is dropped rather than
              // failing the page it arrived in.
              ?ListingMapper.listing(entry),
          ],
          nextCursor: ListingMapper.text(map['nextCursor']),
        );
      },
    );
  }

  @override
  Future<Listing> byId(String id) async {
    try {
      final listing = await _client.get(
        '/listings/$id',
        decode: ListingMapper.listing,
      );
      if (listing == null) {
        throw ListingNotFoundException(id);
      }
      return listing;
    } on ApiException catch (error) {
      if (error.isNotFound) {
        throw ListingNotFoundException(id);
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
  Future<Listing> create(ListingDraft draft) async {
    try {
      final listing = await _client.post(
        '/listings',
        body: {
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
          if (draft.wholesalePrice != null)
            'wholesalePrice': draft.wholesalePrice,
          if (draft.harvestDate != null)
            'harvestDate': _dateOnly(draft.harvestDate!),
          'delivery': draft.delivery.wire,
          if (draft.attributes.isNotEmpty) 'attributes': draft.attributes,
        },
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
