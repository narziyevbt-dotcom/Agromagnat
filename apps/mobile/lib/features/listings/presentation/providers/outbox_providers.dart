import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/cache/cache_providers.dart';
import '../../../../core/network/api_client.dart';
import '../../data/listing_outbox.dart';
import '../../data/repositories/api_listing_repository.dart';
import '../../domain/repositories/listing_repository.dart';
import 'listing_providers.dart';

final listingOutboxProvider = Provider<ListingOutbox>((ref) {
  return ListingOutbox(ref.watch(jsonCacheProvider));
});

final photoOutboxProvider = Provider<PhotoOutbox>((ref) {
  return PhotoOutbox(ref.watch(jsonCacheProvider));
});

@immutable
class OutboxState {
  const OutboxState({
    this.entries = const [],
    this.photoJobs = const [],
    this.sending = false,
  });

  final List<OutboxEntry> entries;

  /// Photos for listings that are already live.
  final List<PhotoJob> photoJobs;

  final bool sending;

  int get pending => entries.length;
  int get pendingPhotos =>
      photoJobs.fold(0, (sum, job) => sum + job.paths.length);
  bool get hasPending => entries.isNotEmpty || photoJobs.isNotEmpty;

  /// Entries the server has refused enough times that retrying is pointless.
  /// They stay — the seller typed them — but they need a person to look.
  List<OutboxEntry> get stuck => [
        for (final entry in entries)
          if (entry.attempts >= ListingOutbox.maxAttempts) entry,
      ];
}

/// Listings waiting for a signal, and the thing that sends them.
class OutboxController extends StateNotifier<OutboxState> {
  OutboxController(this._outbox, this._repository, {this.photos})
      : super(const OutboxState()) {
    state = _snapshot();
  }

  final ListingOutbox _outbox;

  /// Not private: a named parameter cannot carry an underscore, and an
  /// initializer written only to add one is noise.
  final PhotoOutbox? photos;
  final ListingRepository _repository;

  OutboxState _snapshot({bool sending = false}) => OutboxState(
        entries: _outbox.read(),
        photoJobs: photos?.read() ?? const [],
        sending: sending,
      );

  Future<OutboxEntry> enqueue({
    required Map<String, dynamic> body,
    required List<String> photoPaths,
    DateTime? now,
  }) async {
    final entry = await _outbox.add(
      body: body,
      photoPaths: photoPaths,
      now: now ?? DateTime.now(),
    );
    state = _snapshot();
    return entry;
  }

  /// Queues photos for a listing that is already live.
  ///
  /// The listing published and the upload did not — the ordinary EDGE
  /// outcome. Before this the files were simply gone and the seller was told
  /// to add them "later" with nothing in the app that could.
  Future<void> enqueuePhotos({
    required String listingId,
    required List<String> paths,
    String title = '',
    DateTime? now,
  }) async {
    final target = photos;
    if (target == null || paths.isEmpty) {
      return;
    }
    await target.add(
      listingId: listingId,
      paths: paths,
      title: title,
      now: now ?? DateTime.now(),
    );
    state = _snapshot();
  }

  /// Sends what it can. Safe to call whenever — on launch, on resume, on a tap.
  ///
  /// Returns how many went out.
  Future<int> flush() async {
    final repository = _repository;
    if (repository is! ApiListingRepository || state.sending) {
      return 0;
    }

    final queue = _outbox.sendable();
    final photoQueue = photos?.sendable() ?? const <PhotoJob>[];
    if (queue.isEmpty && photoQueue.isEmpty) {
      return 0;
    }

    state = _snapshot(sending: true);
    var sent = 0;

    for (final entry in queue) {
      try {
        final listing = await repository.postBody(entry.body);
        sent++;

        if (entry.photoPaths.isNotEmpty) {
          try {
            await repository.addPhotos(listing.id, entry.photos);
          } on Object {
            // The listing is live, so it comes off this queue either way —
            // sending it a second time is the one thing that must not happen.
            // The photos move to their own queue rather than being dropped.
            await photos?.add(
              listingId: listing.id,
              paths: entry.photoPaths,
              title: entry.title,
              now: DateTime.now(),
            );
          }
        }
        await _outbox.remove(entry.id);
      } on ListingValidationException {
        // The server will never accept this body. Counting the attempt is
        // what eventually stops it being retried on every launch.
        await _outbox.markAttempted(entry.id);
      } on ApiException catch (error) {
        if (error.status == 0) {
          // Still no signal. Stop here rather than working through the queue
          // failing each one — every attempt burns the same battery.
          break;
        }
        await _outbox.markAttempted(entry.id);
      }
    }

    sent += await _flushPhotos(repository, photoQueue);

    state = _snapshot();
    return sent;
  }

  Future<int> _flushPhotos(
    ApiListingRepository repository,
    List<PhotoJob> queue,
  ) async {
    var sent = 0;

    for (final job in queue) {
      try {
        await repository.addPhotos(job.listingId, job.photos);
        await photos?.remove(job.id);
        sent++;
      } on ApiException catch (error) {
        if (error.status == 0) {
          break;
        }
        if (error.isNotFound) {
          // The listing is gone — deleted here or from another device.
          // Retrying uploads at it forever helps nobody.
          await photos?.remove(job.id);
        } else {
          await photos?.markAttempted(job.id);
        }
      } on Object {
        // A file the OS cleared out of its cache directory. Counted, so it
        // stops after three tries rather than on every launch forever.
        await photos?.markAttempted(job.id);
      }
    }

    return sent;
  }

  Future<void> discard(String id) async {
    await _outbox.remove(id);
    await photos?.remove(id);
    state = _snapshot();
  }
}

final outboxControllerProvider =
    StateNotifierProvider<OutboxController, OutboxState>((ref) {
  return OutboxController(
    ref.watch(listingOutboxProvider),
    ref.watch(listingRepositoryProvider),
    photos: ref.watch(photoOutboxProvider),
  );
});
