import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/listings/domain/entities/draft_photo.dart';
import 'package:agromagnat/features/listings/domain/entities/listing.dart';
import 'package:agromagnat/features/listings/domain/entities/listing_draft.dart';
import 'package:agromagnat/features/listings/domain/repositories/listing_repository.dart';

/// Forwards every call to [inner]; override only what a test is about.
///
/// Written after the fourth hand-rolled `implements ListingRepository` in the
/// suite: each new method on the interface broke all of them, and the noise of
/// re-adding four identical delegations buried the one line each fake existed
/// to change.
class DelegatingListingRepository implements ListingRepository {
  DelegatingListingRepository(this.inner);

  final ListingRepository inner;

  @override
  Future<Paginated<Listing>> search(ListingQuery query) => inner.search(query);

  @override
  Future<Listing> byId(String id) => inner.byId(id);

  @override
  Future<void> setFavorite(String id, {required bool saved}) =>
      inner.setFavorite(id, saved: saved);

  @override
  Future<Listing> create(ListingDraft draft) => inner.create(draft);

  @override
  Future<Listing> update(String id, ListingDraft draft) =>
      inner.update(id, draft);

  @override
  Future<Listing> addPhotos(String listingId, List<DraftPhoto> photos) =>
      inner.addPhotos(listingId, photos);

  @override
  Future<void> removePhoto(String listingId, String photoId) =>
      inner.removePhoto(listingId, photoId);

  @override
  Future<Paginated<Listing>> mine({String? cursor, int limit = 20}) =>
      inner.mine(cursor: cursor, limit: limit);

  @override
  Future<Listing> markSold(String id) => inner.markSold(id);

  @override
  Future<void> remove(String id) => inner.remove(id);
}
