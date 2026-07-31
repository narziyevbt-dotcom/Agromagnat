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
  });

  const Paginated.empty()
      : items = const [],
        nextCursor = null;

  final List<T> items;
  final String? nextCursor;

  bool get hasMore => nextCursor != null;

  /// Appends the next page, keeping the earlier items in place.
  Paginated<T> append(Paginated<T> next) {
    return Paginated<T>(
      items: [...items, ...next.items],
      nextCursor: next.nextCursor,
    );
  }
}
