import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../listings/data/photo_picker.dart';
import '../../../listings/domain/entities/category.dart';
import '../../../listings/domain/entities/draft_photo.dart';
import '../../../listings/domain/entities/listing.dart';
import '../../../listings/domain/entities/listing_draft.dart';
import '../../../listings/domain/entities/location.dart';
import '../../../listings/domain/entities/units.dart';
import '../../../listings/domain/repositories/listing_repository.dart';
import '../../../listings/presentation/providers/listing_providers.dart';

@immutable
class DraftState {
  const DraftState({
    this.draft = const ListingDraft(),
    this.errors = const {},
    this.submitting = false,
    this.published,
    this.failure,
    this.uploaded = 0,
    this.photoFailure,
  });

  final ListingDraft draft;

  /// Only populated after a submit attempt. Showing errors before the seller
  /// has finished typing turns a blank form into a wall of red.
  final Map<String, String> errors;

  final bool submitting;

  /// Set once the listing exists, which is what the screen navigates on.
  final Listing? published;

  /// Something that is not a field problem — no connection, server down.
  final String? failure;

  /// How many photos have made it up, for the progress line during submit.
  final int uploaded;

  /// Set when the listing published but its photos did not. Deliberately not
  /// a [failure]: the listing exists and is live, and saying otherwise would
  /// send the seller to post it a second time.
  final String? photoFailure;

  DraftState copyWith({
    ListingDraft? draft,
    Map<String, String>? errors,
    bool? submitting,
    Object? published = _unset,
    Object? failure = _unset,
    int? uploaded,
    Object? photoFailure = _unset,
  }) {
    return DraftState(
      draft: draft ?? this.draft,
      errors: errors ?? this.errors,
      submitting: submitting ?? this.submitting,
      published: published == _unset ? this.published : published as Listing?,
      failure: failure == _unset ? this.failure : failure as String?,
      uploaded: uploaded ?? this.uploaded,
      photoFailure:
          photoFailure == _unset ? this.photoFailure : photoFailure as String?,
    );
  }

  static const Object _unset = Object();
}

class DraftController extends StateNotifier<DraftState> {
  DraftController(this._repository, this._picker) : super(const DraftState());

  final ListingRepository _repository;
  final PhotoPicker _picker;

  /// The API's ceiling. Matches MAX_PHOTOS in listings.service.ts.
  static const int maxPhotos = 5;

  void _edit(ListingDraft next) {
    // Errors are recomputed rather than kept: once a field is fixed its message
    // has to go, and clearing all of them would hide the ones still unfixed.
    state = state.copyWith(
      draft: next,
      errors: state.errors.isEmpty
          ? const {}
          : {
              for (final entry in next.validate().entries)
                if (state.errors.containsKey(entry.key)) entry.key: entry.value,
            },
      failure: null,
    );
  }

  /// Switching category drops whatever the new one does not ask for.
  void setCategory(ListingCategory category) =>
      _edit(state.draft.withCategory(category));

  void setTitle(String value) => _edit(state.draft.copyWith(title: value));

  void setDescription(String value) =>
      _edit(state.draft.copyWith(description: value));

  void setQuantity(num? value) => _edit(state.draft.copyWith(quantity: value));

  void setQuantityUnit(QuantityUnit unit) =>
      _edit(state.draft.copyWith(quantityUnit: unit));

  void setPrice(num? value) => _edit(state.draft.copyWith(price: value));

  void setPriceUnit(PriceUnit unit) => _edit(state.draft.copyWith(priceUnit: unit));

  void setRegion(Region? region) {
    // A district only means something inside its region.
    _edit(state.draft.copyWith(region: region, district: null));
  }

  void setDistrict(District? district) =>
      _edit(state.draft.copyWith(district: district));

  void setMinOrder(num? value) => _edit(state.draft.copyWith(minOrder: value));

  void setWholesalePrice(num? value) =>
      _edit(state.draft.copyWith(wholesalePrice: value));

  void setHarvestDate(DateTime? date) =>
      _edit(state.draft.copyWith(harvestDate: date));

  void setDelivery(DeliveryOption option) =>
      _edit(state.draft.copyWith(delivery: option));

  void setAttribute(String key, Object? value) {
    final next = Map<String, Object>.from(state.draft.attributes);
    if (value == null) {
      next.remove(key);
    } else {
      next[key] = value;
    }
    _edit(state.draft.copyWith(attributes: next));
  }

  // --- photos ---------------------------------------------------------

  int get remainingPhotoSlots => maxPhotos - state.draft.photos.length;

  Future<void> addFromCamera() async {
    if (remainingPhotoSlots <= 0) {
      return;
    }
    final photo = await _picker.takePhoto();
    if (photo != null) {
      _addPhotos([photo]);
    }
  }

  Future<void> addFromGallery() async {
    final slots = remainingPhotoSlots;
    if (slots <= 0) {
      return;
    }
    _addPhotos(await _picker.pickFromGallery(limit: slots));
  }

  void removePhoto(DraftPhoto photo) {
    _edit(
      state.draft.copyWith(
        photos: [...state.draft.photos]..remove(photo),
      ),
    );
  }

  /// Promotes a photo to the front, which is what the feed shows.
  void makeCover(DraftPhoto photo) {
    final rest = [...state.draft.photos]..remove(photo);
    _edit(state.draft.copyWith(photos: [photo, ...rest]));
  }

  void _addPhotos(List<DraftPhoto> incoming) {
    // Picking the same file twice is easy to do in a gallery grid, and two
    // identical photos on a listing look like a mistake because they are one.
    final existing = state.draft.photos;
    final fresh = incoming.where((photo) => !existing.contains(photo));

    _edit(
      state.draft.copyWith(
        photos: [...existing, ...fresh].take(maxPhotos).toList(),
      ),
    );
  }

  /// Validates, then publishes. Returns true when the listing exists.
  Future<bool> submit() async {
    if (state.submitting) {
      return false;
    }

    final errors = state.draft.validate();
    if (errors.isNotEmpty) {
      // Checked here so a farmer on EDGE finds out before spending a round
      // trip on it — but the server checks the same rules and wins.
      state = state.copyWith(errors: errors, failure: null);
      return false;
    }

    state = state.copyWith(submitting: true, errors: const {}, failure: null);

    final Listing listing;
    try {
      listing = await _repository.create(state.draft);
    } on ListingValidationException catch (error) {
      state = state.copyWith(submitting: false, errors: error.errors);
      return false;
    } on Object {
      state = state.copyWith(
        submitting: false,
        failure: "E'lon joylanmadi. Internetni tekshirib, qayta urinib ko'ring",
      );
      return false;
    }

    // The listing is live from here on. Photos are a separate call, and it
    // failing must not read as the post having failed — that would send the
    // seller round to publish a duplicate.
    if (state.draft.photos.isEmpty) {
      state = state.copyWith(submitting: false, published: listing);
      return true;
    }

    try {
      final withPhotos =
          await _repository.addPhotos(listing.id, state.draft.photos);
      state = state.copyWith(
        submitting: false,
        published: withPhotos,
        uploaded: state.draft.photos.length,
      );
    } on Object {
      state = state.copyWith(
        submitting: false,
        published: listing,
        photoFailure:
            "E'lon joylandi, lekin rasmlar yuklanmadi. Keyinroq qo'shishingiz mumkin",
      );
    }
    return true;
  }
}

/// The seam where the real camera is swapped for a fake in tests — the
/// platform channel behind `image_picker` does not exist under `flutter test`.
final photoPickerProvider = Provider<PhotoPicker>((ref) {
  return DevicePhotoPicker();
});

final draftControllerProvider =
    StateNotifierProvider.autoDispose<DraftController, DraftState>((ref) {
  return DraftController(
    ref.watch(listingRepositoryProvider),
    ref.watch(photoPickerProvider),
  );
});
