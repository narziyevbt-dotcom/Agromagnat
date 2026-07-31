import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../ai/domain/entities/ai_draft.dart';
import '../../../listings/data/fixtures/catalog_fixtures.dart';
import '../../../../core/network/api_client.dart';
import '../../../listings/data/photo_picker.dart';
import '../../../listings/data/repositories/api_listing_repository.dart';
import '../../../listings/domain/entities/category.dart';
import '../../../listings/domain/entities/draft_photo.dart';
import '../../../listings/domain/entities/listing.dart';
import '../../../listings/domain/entities/listing_draft.dart';
import '../../../listings/domain/entities/location.dart';
import '../../../listings/domain/entities/units.dart';
import '../../../listings/domain/repositories/listing_repository.dart';
import '../../../listings/presentation/providers/listing_providers.dart';
import '../../../listings/presentation/providers/outbox_providers.dart';

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
    this.queued = false,
    this.editingId,
    this.existingPhotos = const [],
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

  /// The listing went to the outbox instead of the server. Not a failure
  /// either — it is written down and will go out — but the seller has to know
  /// it is not visible yet.
  final bool queued;

  /// Set when the form was opened on a listing that already exists. Null is a
  /// new listing.
  final String? editingId;

  /// Photos already on the listing being edited.
  ///
  /// They live on the server, so they are never re-uploaded — but they count
  /// against the API's five, and the seller has to be able to take a bad one
  /// off.
  final List<ListingPhoto> existingPhotos;

  bool get isEditing => editingId != null;

  DraftState copyWith({
    ListingDraft? draft,
    Map<String, String>? errors,
    bool? submitting,
    Object? published = _unset,
    Object? failure = _unset,
    int? uploaded,
    Object? photoFailure = _unset,
    bool? queued,
    String? editingId,
    List<ListingPhoto>? existingPhotos,
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
      queued: queued ?? this.queued,
      editingId: editingId ?? this.editingId,
      existingPhotos: existingPhotos ?? this.existingPhotos,
    );
  }

  static const Object _unset = Object();
}

class DraftController extends StateNotifier<DraftState> {
  DraftController(this._repository, this._picker, {this.onQueue})
      : super(const DraftState());

  final ListingRepository _repository;
  final PhotoPicker _picker;

  /// Where a listing goes when the phone has no signal. Null means there is
  /// nowhere to put it and the submit simply fails — which is what the mock
  /// setup does, and what the app did before the outbox existed.
  final Future<void> Function(Map<String, dynamic> body, List<String> photos)?
      onQueue;

  /// The API's ceiling. Matches MAX_PHOTOS in listings.service.ts.
  static const int maxPhotos = 5;

  /// Opens the form on a listing that already exists.
  ///
  /// [category] must come from the catalogue, not from `listing.category` —
  /// only the catalogue's copy carries the form spec, and without one the form
  /// renders nothing below the category row.
  void beginEdit(Listing listing, ListingCategory category) {
    state = DraftState(
      draft: ListingDraft.fromListing(listing, category),
      editingId: listing.id,
      existingPhotos: listing.photos,
    );
  }

  /// Deletes a photo that is already on the listing.
  ///
  /// Immediate, not on save: it is its own endpoint, and a photo queued for
  /// deletion until the seller happens to press "Saqlash" would still be on
  /// the listing every buyer is looking at meanwhile.
  ///
  /// Returns false when the server refused, having put the photo back.
  Future<bool> removeExistingPhoto(ListingPhoto photo) async {
    final id = state.editingId;
    final before = state.existingPhotos;
    if (id == null) {
      return false;
    }

    state = state.copyWith(
      existingPhotos: [
        for (final candidate in before)
          if (candidate.id != photo.id) candidate,
      ],
    );

    try {
      await _repository.removePhoto(id, photo.id);
      return true;
    } on Object {
      state = state.copyWith(existingPhotos: before);
      return false;
    }
  }

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

  // --- AI draft -------------------------------------------------------

  /// Fills the form from an AI draft, leaving everything editable.
  ///
  /// Applied field by field rather than by replacing the draft wholesale: the
  /// seller may have already typed something, and having the assistant wipe it
  /// is worse than having it fill nothing. Anything the draft left null is
  /// left as it was.
  ///
  /// Units are taken from the category's spec, not from the draft. The model
  /// picks the category; the spec decides what units that category allows —
  /// otherwise a suggestion of "kg" for machinery lands an illegal value in a
  /// select that cannot show it. Same guard the backend applies.
  void applyAiDraft(AiDraft draft) {
    final slug = draft.categorySlug;
    if (slug != null) {
      final category = CatalogFixtures.categories
          .where((candidate) => candidate.slug == slug)
          .firstOrNull;
      if (category != null) {
        setCategory(category);
      }
    }

    if (draft.title.trim().isNotEmpty && state.draft.title.trim().isEmpty) {
      setTitle(draft.title.trim());
    }
    if (draft.description.trim().isNotEmpty &&
        state.draft.description.trim().isEmpty) {
      setDescription(draft.description.trim());
    }

    final spec = state.draft.spec;

    if (draft.quantity != null) {
      setQuantity(draft.quantity);
    }
    final quantityUnit = _legalUnit(draft.quantityUnit, spec?.quantity.units);
    if (quantityUnit != null) {
      setQuantityUnit(quantityUnit);
    }

    if (draft.price != null) {
      setPrice(draft.price);
    }
    final priceUnit = _legalUnit(draft.priceUnit, spec?.price.units);
    if (priceUnit != null) {
      setPriceUnit(priceUnit);
    }

    if (draft.harvestDate != null && spec?.optional.harvestDate == true) {
      setHarvestDate(draft.harvestDate);
    }

    for (final entry in draft.attributes.entries) {
      // A key the model invented is dropped here rather than rejected at
      // publish time — the same thing validateAttributes does server-side.
      final declared =
          spec?.attributes.any((attribute) => attribute.key == entry.key) ?? false;
      if (declared) {
        setAttribute(entry.key, entry.value);
      }
    }
  }

  QuantityUnit? _legalUnit(String? wire, List<QuantityUnit>? allowed) {
    if (wire == null || allowed == null) {
      return null;
    }
    final unit = QuantityUnit.values.where((candidate) => candidate.wire == wire);
    if (unit.isEmpty || !allowed.contains(unit.first)) {
      return null;
    }
    return unit.first;
  }

  // --- photos ---------------------------------------------------------

  int get remainingPhotoSlots =>
      maxPhotos - state.existingPhotos.length - state.draft.photos.length;

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

    final editingId = state.editingId;

    final Listing listing;
    try {
      listing = editingId == null
          ? await _repository.create(state.draft)
          : await _repository.update(editingId, state.draft);
    } on ListingValidationException catch (error) {
      state = state.copyWith(submitting: false, errors: error.errors);
      return false;
    } on ApiException catch (error) {
      // No signal, and there is somewhere to put it. The seller typed this
      // once, in the sun, on a phone keyboard — they will not do it twice.
      //
      // An *edit* is never queued: the outbox replays creates, and a queued
      // edit would have to be ordered against them. Telling the seller their
      // correction is saved when it is sitting in a queue behind a listing
      // that does not exist yet is worse than telling them it failed.
      if (error.status == 0 && onQueue != null && editingId == null) {
        await onQueue!(
          ApiListingRepository.bodyFor(state.draft),
          [for (final photo in state.draft.photos) photo.path],
        );
        state = state.copyWith(submitting: false, queued: true);
        return true;
      }
      state = state.copyWith(submitting: false, failure: error.messageUz);
      return false;
    } on Object {
      state = state.copyWith(
        submitting: false,
        failure: editingId == null
            ? "E'lon joylanmadi. Internetni tekshirib, qayta urinib ko'ring"
            : "O'zgarishlar saqlanmadi. Internetni tekshirib, qayta urinib ko'ring",
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
        photoFailure: editingId == null
            ? "E'lon joylandi, lekin rasmlar yuklanmadi. Keyinroq qo'shishingiz mumkin"
            : "O'zgarishlar saqlandi, lekin yangi rasmlar yuklanmadi",
      );
    }
    return true;
  }
}

/// A listing to edit, with the catalogue category that knows its questions.
///
/// The nested category on a listing carries no form spec, so the caller has to
/// pair it with the catalogue's copy before the form can ask anything.
@immutable
class EditTarget {
  const EditTarget(this.listing, this.category);

  final Listing listing;
  final ListingCategory category;
}

/// What the form was opened on. Null — the default — is a new listing.
///
/// Overridden in a ProviderScope around the edit screen rather than pushed in
/// from a widget lifecycle: Riverpod forbids writing to a provider during
/// build or initState, and seeding the controller as it is constructed also
/// avoids a frame of empty form before the values arrive.
final editTargetProvider = Provider<EditTarget?>((ref) => null);

/// The seam where the real camera is swapped for a fake in tests — the
/// platform channel behind `image_picker` does not exist under `flutter test`.
final photoPickerProvider = Provider<PhotoPicker>((ref) {
  return DevicePhotoPicker();
});

final draftControllerProvider =
    StateNotifierProvider.autoDispose<DraftController, DraftState>((ref) {
  final controller = DraftController(
    ref.watch(listingRepositoryProvider),
    ref.watch(photoPickerProvider),
    onQueue: (body, photos) => ref
        .read(outboxControllerProvider.notifier)
        .enqueue(body: body, photoPaths: photos),
  );

  final target = ref.watch(editTargetProvider);
  if (target != null) {
    controller.beginEdit(target.listing, target.category);
  }
  return controller;
}, dependencies: [editTargetProvider]);
