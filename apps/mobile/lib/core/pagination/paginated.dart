import 'package:flutter/foundation.dart';

/// A cursor-paginated page, matching the API's envelope.
///
/// Cursors rather than page numbers: the feed is ordered by creation time and
/// people post while a buyer is scrolling, so offsets would show duplicates
/// and skip rows.
@immutable
class Paginated<T> {
  const Paginated({
    required this.items,
    this.nextCursor,
    this.cachedAt,
  });

  const Paginated.empty()
      : items = const [],
        nextCursor = null,
        cachedAt = null;

  final List<T> items;
  final String? nextCursor;

  /// When this page was stored, if it came off disk rather than the network.
  ///
  /// Null means it is fresh. The screen shows the age, because a farmer
  /// reading three-day-old prices and believing them current is worse than a
  /// farmer told the app is offline.
  final DateTime? cachedAt;

  bool get isStale => cachedAt != null;

  bool get hasMore => nextCursor != null;

  /// Appends the next page, keeping the earlier items in place.
  Paginated<T> append(Paginated<T> next) {
    return Paginated<T>(
      items: [...items, ...next.items],
      nextCursor: next.nextCursor,
      // Appending a fresh page onto a cached one makes the whole list as
      // stale as its oldest part.
      cachedAt: next.cachedAt ?? cachedAt,
    );
  }
}
