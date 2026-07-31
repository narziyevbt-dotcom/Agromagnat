import '../entities/ai_draft.dart';

/// Raised when the per-user hourly limit is hit.
///
/// Its own type because the screen says something specific: the seller has not
/// done anything wrong and typing still works, which a generic error would not
/// convey.
class AiRateLimitException implements Exception {
  const AiRateLimitException(this.messageUz);

  /// Uzbek, from the API, shown verbatim.
  final String messageUz;

  @override
  String toString() => 'AiRateLimitException($messageUz)';
}

abstract interface class AiRepository {
  /// One sentence — typed or dictated — into a filled listing draft.
  ///
  /// `POST /ai/draft`, 30 per user per hour.
  Future<AiDraft> draftListing(String text);
}
