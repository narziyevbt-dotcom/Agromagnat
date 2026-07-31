import 'package:flutter/foundation.dart';

import '../../../core/cache/json_cache.dart';
import '../domain/entities/draft_photo.dart';

/// A listing written but not yet accepted by the server.
@immutable
class OutboxEntry {
  const OutboxEntry({
    required this.id,
    required this.body,
    required this.photoPaths,
    required this.queuedAt,
    this.attempts = 0,
  });

  /// Local, so the queue can be addressed before the server has given it one.
  final String id;

  /// Exactly the JSON `POST /listings` takes.
  ///
  /// The request body is stored rather than the draft entity. A draft would
  /// have to be rehydrated — category, region and district looked up again —
  /// and a category renamed while the listing sat in the queue would fail the
  /// rehydration rather than the post. The body is already the thing the
  /// server validates.
  final Map<String, dynamic> body;

  /// On-device paths, uploaded after the listing exists.
  final List<String> photoPaths;

  final DateTime queuedAt;

  /// How many times sending has been tried. Kept so a listing the server
  /// keeps rejecting cannot spin forever.
  final int attempts;

  String get title => body['title'] as String? ?? '';

  List<DraftPhoto> get photos => [
        for (final path in photoPaths) DraftPhoto(path: path, sizeBytes: 0),
      ];

  OutboxEntry withAttempt() => OutboxEntry(
        id: id,
        body: body,
        photoPaths: photoPaths,
        queuedAt: queuedAt,
        attempts: attempts + 1,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'body': body,
        'photoPaths': photoPaths,
        'queuedAt': queuedAt.toIso8601String(),
        'attempts': attempts,
      };

  static OutboxEntry? fromJson(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    final body = json['body'];
    final queuedAt = DateTime.tryParse(json['queuedAt'] as String? ?? '');

    if (id is! String || body is! Map || queuedAt == null) {
      return null;
    }
    return OutboxEntry(
      id: id,
      body: Map<String, dynamic>.from(body),
      photoPaths: [
        for (final path in (json['photoPaths'] as List? ?? const []))
          path.toString(),
      ],
      queuedAt: queuedAt,
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Listings waiting for a signal.
///
/// A farmer standing in a field with no bars finishes a listing and taps
/// publish. Losing it there is the worst thing this app can do: they typed it
/// once, in the sun, on a phone keyboard, and they will not do it twice.
class ListingOutbox {
  ListingOutbox(this._cache);

  final JsonCache? _cache;

  static const String _key = 'outbox';

  /// Beyond this the server is refusing it for a reason a retry will not fix.
  /// The entry stays — it is the seller's work — but it stops being sent.
  static const int maxAttempts = 5;

  List<OutboxEntry> read() {
    final entry = _cache?.read<List<OutboxEntry>>(
      _key,
      (json) => [
        for (final row in (json as List)) ?OutboxEntry.fromJson(row),
      ],
    );
    return entry?.value ?? const [];
  }

  Future<void> _write(List<OutboxEntry> entries) async {
    await _cache?.write(_key, [for (final e in entries) e.toJson()]);
  }

  Future<OutboxEntry> add({
    required Map<String, dynamic> body,
    required List<String> photoPaths,
    required DateTime now,
  }) async {
    final entry = OutboxEntry(
      // Time-based rather than random: no dependency on a UUID package, and
      // two listings queued in the same millisecond is not a real scenario
      // for one person typing.
      id: 'out-${now.microsecondsSinceEpoch}',
      body: body,
      photoPaths: photoPaths,
      queuedAt: now,
    );
    await _write([...read(), entry]);
    return entry;
  }

  Future<void> remove(String id) async {
    await _write([for (final e in read()) if (e.id != id) e]);
  }

  Future<void> markAttempted(String id) async {
    await _write([
      for (final e in read()) if (e.id == id) e.withAttempt() else e,
    ]);
  }

  /// Entries still worth sending.
  List<OutboxEntry> sendable() =>
      [for (final e in read()) if (e.attempts < maxAttempts) e];

  Future<void> clear() async => _cache?.remove(_key);
}
