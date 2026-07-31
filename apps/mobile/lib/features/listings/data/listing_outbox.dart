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

/// Photos for a listing that is already live.
///
/// Kept apart from [OutboxEntry] because the two are at different stages: this
/// one has a server id and only needs its files uploading. Folding them into
/// one queue would mean an entry that is half sent, and "half sent" is the
/// state that eventually posts a listing twice.
@immutable
class PhotoJob {
  const PhotoJob({
    required this.id,
    required this.listingId,
    required this.paths,
    required this.queuedAt,
    this.title = '',
    this.attempts = 0,
  });

  final String id;
  final String listingId;
  final List<String> paths;
  final DateTime queuedAt;

  /// Only for the banner — a queue that says "3 ta rasm" without saying which
  /// listing is a queue nobody can act on.
  final String title;

  final int attempts;

  List<DraftPhoto> get photos => [
        for (final path in paths) DraftPhoto(path: path, sizeBytes: 0),
      ];

  PhotoJob withAttempt() => PhotoJob(
        id: id,
        listingId: listingId,
        paths: paths,
        queuedAt: queuedAt,
        title: title,
        attempts: attempts + 1,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'listingId': listingId,
        'paths': paths,
        'queuedAt': queuedAt.toIso8601String(),
        'title': title,
        'attempts': attempts,
      };

  static PhotoJob? fromJson(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    final listingId = json['listingId'];
    final queuedAt = DateTime.tryParse(json['queuedAt'] as String? ?? '');

    if (id is! String || listingId is! String || queuedAt == null) {
      return null;
    }
    return PhotoJob(
      id: id,
      listingId: listingId,
      paths: [
        for (final path in (json['paths'] as List? ?? const [])) path.toString(),
      ],
      queuedAt: queuedAt,
      title: json['title'] as String? ?? '',
      attempts: (json['attempts'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Photos waiting to go up on a listing that already exists.
///
/// Publishing and uploading are two requests, and on EDGE the second is the
/// one that dies: the listing goes live and its photos do not. Before this the
/// photos were simply gone, and the seller was told to add them "later" with
/// nothing in the app that could.
class PhotoOutbox {
  PhotoOutbox(this._cache);

  final JsonCache? _cache;

  static const String _key = 'outbox_photos';

  /// Lower than the listing queue's five. A listing is the seller's typing and
  /// worth pushing at; a photo is a file the OS may already have deleted out
  /// of its cache directory, and retrying that forever is battery for nothing.
  static const int maxAttempts = 3;

  List<PhotoJob> read() {
    final entry = _cache?.read<List<PhotoJob>>(
      _key,
      (json) => [
        for (final row in (json as List)) ?PhotoJob.fromJson(row),
      ],
    );
    return entry?.value ?? const [];
  }

  Future<void> _write(List<PhotoJob> jobs) async {
    await _cache?.write(_key, [for (final job in jobs) job.toJson()]);
  }

  Future<PhotoJob> add({
    required String listingId,
    required List<String> paths,
    required DateTime now,
    String title = '',
  }) async {
    final job = PhotoJob(
      id: 'ph-${now.microsecondsSinceEpoch}',
      listingId: listingId,
      paths: paths,
      queuedAt: now,
      title: title,
    );

    // One job per listing: a second attempt at the same photos replaces the
    // first rather than queueing them twice.
    await _write([
      for (final existing in read())
        if (existing.listingId != listingId) existing,
      job,
    ]);
    return job;
  }

  Future<void> remove(String id) async {
    await _write([for (final job in read()) if (job.id != id) job]);
  }

  Future<void> markAttempted(String id) async {
    await _write([
      for (final job in read()) if (job.id == id) job.withAttempt() else job,
    ]);
  }

  List<PhotoJob> sendable() =>
      [for (final job in read()) if (job.attempts < maxAttempts) job];

  Future<void> clear() async => _cache?.remove(_key);
}
