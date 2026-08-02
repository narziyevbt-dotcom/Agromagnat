import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/pagination/paginated.dart';
import '../../../listings/data/api/listing_mapper.dart';
import '../../../listings/domain/entities/draft_photo.dart';
import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';
import '../api/chat_mapper.dart';

class ApiChatRepository implements ChatRepository {
  ApiChatRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<ChatSummary>> inbox() {
    return _client.get(
      '/chats',
      decode: (body) => [
        for (final row in (body as List? ?? const [])) ?ChatMapper.summary(row),
      ],
    );
  }

  @override
  Future<ChatSummary> openForListing(String listingId) async {
    try {
      // The API returns the chat row, not a summary, so the id it hands back
      // is used to fetch the view the screens actually render. One extra
      // request, once per conversation ever opened.
      final id = await _client.post(
        '/listings/$listingId/chat',
        decode: (body) => body is Map ? body['id'] as String? : null,
      );
      if (id == null) {
        throw const ApiException(0, "Suhbat ochilmadi");
      }
      return byId(id);
    } on ApiException catch (error) {
      // 400 from this endpoint means one thing: it is the caller's own
      // listing. Worth its own type so the screen can stop offering the
      // button rather than showing a network-sounding error.
      if (error.status == 400) {
        throw const CannotChatWithSelfException();
      }
      rethrow;
    }
  }

  @override
  Future<ChatSummary> byId(String chatId) async {
    final summary = await _client.get(
      '/chats/$chatId',
      decode: ChatMapper.summary,
    );
    if (summary == null) {
      throw const ApiException(404, 'Suhbat topilmadi');
    }
    return summary;
  }

  @override
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor}) {
    return _client.get(
      '/chats/$chatId/messages',
      query: {'cursor': cursor},
      decode: (body) {
        final map = body is Map ? body : const {};
        return Paginated<ChatMessage>(
          items: [
            for (final row in (map['items'] as List? ?? const []))
              ?ChatMapper.message(row),
          ],
          nextCursor: ListingMapper.text(map['nextCursor']),
        );
      },
    );
  }

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) async {
    final message = await _client.post(
      '/chats/$chatId/messages',
      body: {'body': body, if (clientId != null) 'clientId': clientId},
      decode: ChatMapper.message,
    );
    if (message == null) {
      throw const ApiException(0, 'Xabar yuborildi, lekin javob o\'qilmadi');
    }
    return message;
  }

  @override
  Future<ChatMessage> sendPhoto(String chatId, DraftPhoto photo) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(photo.path),
    });

    final message = await _client.upload(
      '/chats/$chatId/photo',
      form,
      decode: ChatMapper.message,
    );
    if (message == null) {
      throw const ApiException(0, "Rasm yuborildi, lekin javob o'qilmadi");
    }
    return message;
  }

  @override
  Future<void> markRead(String chatId) =>
      _client.post<void>('/chats/$chatId/read', decode: (_) {});

  @override
  Future<int> unreadTotal() {
    return _client.get(
      '/chats/unread-count',
      decode: (body) =>
          body is Map ? ListingMapper.intOr(body['unread'], 0) : 0,
    );
  }
}
