import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/listings/domain/entities/draft_photo.dart';
import 'package:agromagnat/features/messages/domain/entities/chat.dart';
import 'package:agromagnat/features/messages/domain/repositories/chat_repository.dart';

/// Forwards every call to [inner]; override only what a test is about.
///
/// The same reason [DelegatingListingRepository] exists: hand-rolled fakes
/// break on every method added to the interface, and re-adding the identical
/// delegations buries the one line each fake exists to change.
class DelegatingChatRepository implements ChatRepository {
  DelegatingChatRepository(this.inner);

  final ChatRepository inner;

  @override
  Future<List<ChatSummary>> inbox() => inner.inbox();

  @override
  Future<ChatSummary> openForListing(String listingId) =>
      inner.openForListing(listingId);

  @override
  Future<ChatSummary> byId(String chatId) => inner.byId(chatId);

  @override
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor}) =>
      inner.messages(chatId, cursor: cursor);

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) =>
      inner.send(chatId, body, clientId: clientId);

  @override
  Future<ChatMessage> sendPhoto(String chatId, DraftPhoto photo) =>
      inner.sendPhoto(chatId, photo);

  @override
  Future<void> markRead(String chatId) => inner.markRead(chatId);

  @override
  Future<int> unreadTotal() => inner.unreadTotal();
}
