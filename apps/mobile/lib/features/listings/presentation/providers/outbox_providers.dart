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

@immutable
class OutboxState {
  const OutboxState({this.entries = const [], this.sending = false});

  final List<OutboxEntry> entries;
  final bool sending;

  int get pending => entries.length;
  bool get hasPending => entries.isNotEmpty;

  /// Entries the server has refused enough times that retrying is pointless.
  /// They stay — the seller typed them — but they need a person to look.
  List<OutboxEntry> get stuck => [
        for (final entry in entries)
          if (entry.attempts >= ListingOutbox.maxAttempts) entry,
      ];
}

/// Listings waiting for a signal, and the thing that sends them.
class OutboxController extends StateNotifier<OutboxState> {
  OutboxController(this._outbox, this._repository)
      : super(const OutboxState()) {
    state = OutboxState(entries: _outbox.read());
  }

  final ListingOutbox _outbox;
  final ListingRepository _repository;

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
    state = OutboxState(entries: _outbox.read());
    return entry;
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
    if (queue.isEmpty) {
      return 0;
    }

    state = OutboxState(entries: state.entries, sending: true);
    var sent = 0;

    for (final entry in queue) {
      try {
        final listing = await repository.postBody(entry.body);
        sent++;

        if (entry.photoPaths.isNotEmpty) {
          try {
            await repository.addPhotos(listing.id, entry.photos);
          } on Object {
            // The listing is live. A photo file the OS cleared out of its
            // cache directory while the entry waited is not a reason to send
            // the listing again.
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

    state = OutboxState(entries: _outbox.read());
    return sent;
  }

  Future<void> discard(String id) async {
    await _outbox.remove(id);
    state = OutboxState(entries: _outbox.read());
  }
}

final outboxControllerProvider =
    StateNotifierProvider<OutboxController, OutboxState>((ref) {
  return OutboxController(
    ref.watch(listingOutboxProvider),
    ref.watch(listingRepositoryProvider),
  );
});
