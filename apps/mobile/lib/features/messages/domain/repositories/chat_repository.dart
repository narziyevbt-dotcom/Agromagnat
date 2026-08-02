import '../../../../core/pagination/paginated.dart';
import '../../../listings/domain/entities/draft_photo.dart';
import '../entities/chat.dart';

/// Raised when the seller taps "Yozish" on their own listing.
///
/// The API refuses it, and it is worth a distinct type: the message is not an
/// error the user caused by being offline, it is the app offering something it
/// should not have.
class CannotChatWithSelfException implements Exception {
  const CannotChatWithSelfException();
}

abstract interface class ChatRepository {
  /// The caller's conversations, most recent first.
  Future<List<ChatSummary>> inbox();

  /// Opens the conversation about a listing, or returns the one that exists.
  ///
  /// One thread per (listing, buyer) pair — the same rule the API enforces —
  /// so tapping "Yozish" twice does not create two threads about one lot.
  Future<ChatSummary> openForListing(String listingId);

  Future<ChatSummary> byId(String chatId);

  /// History, newest first, cursor-paginated.
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor});

  /// Sends a message.
  ///
  /// [clientId] is generated on the device and passed through so a retry after
  /// a timeout is stored once. Without it a message sent on EDGE — where the
  /// request often succeeds and the *response* is what gets lost — arrives
  /// twice.
  Future<ChatMessage> send(String chatId, String body, {String? clientId});

  /// Sends a photo.
  ///
  /// No client id, unlike [send]: an upload that timed out has not been
  /// stored, and a retry that re-sent the same bytes would cost the sender the
  /// bandwidth again — which on this connection is the expensive part.
  Future<ChatMessage> sendPhoto(String chatId, DraftPhoto photo);

  /// Clears the other side's unread count for this conversation.
  Future<void> markRead(String chatId);

  /// Total unread across every conversation — the bottom-nav badge.
  Future<int> unreadTotal();
}
