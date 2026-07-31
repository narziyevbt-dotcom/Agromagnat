import '../../../listings/data/api/listing_mapper.dart';
import '../../../listings/domain/entities/units.dart';
import '../../domain/entities/chat.dart';

/// JSON from the chat endpoints into entities.
///
/// Total in the same way [ListingMapper] is: one unreadable row costs that row,
/// not the inbox it arrived in.
abstract final class ChatMapper {
  static ChatParticipant? participant(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    if (id is! String) {
      return null;
    }
    return ChatParticipant(
      id: id,
      phone: json['phone'] as String? ?? '',
      name: ListingMapper.text(json['name']),
      isVerified: json['isVerified'] as bool? ?? false,
    );
  }

  static ChatSummary? summary(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    final counterpart = participant(json['counterpart']);
    if (id is! String || counterpart == null) {
      return null;
    }

    return ChatSummary(
      id: id,
      listingId: json['listingId'] as String? ?? '',
      listingTitle: json['listingTitle'] as String? ?? '',
      listingPhotoUrl: ListingMapper.text(json['listingPhotoUrl']),
      // Money comes back as a string here too — same Postgres numeric.
      listingPrice: ListingMapper.number(json['listingPrice']),
      listingPriceUnit: json['listingPriceUnit'] == null
          ? null
          : QuantityUnit.fromWire(json['listingPriceUnit'] as String?),
      counterpart: counterpart,
      role: ChatRole.fromWire(json['role'] as String?),
      lastMessageText: ListingMapper.text(json['lastMessageText']),
      lastMessageAt: ListingMapper.date(json['lastMessageAt']),
      unreadCount: ListingMapper.intOr(json['unreadCount'], 0),
    );
  }

  static ChatMessage? message(dynamic json) {
    if (json is! Map) {
      return null;
    }
    final id = json['id'];
    final chatId = json['chatId'];
    final senderId = json['senderId'];
    final createdAt = ListingMapper.date(json['createdAt']);

    if (id is! String ||
        chatId is! String ||
        senderId is! String ||
        createdAt == null) {
      return null;
    }

    return ChatMessage(
      id: id,
      chatId: chatId,
      senderId: senderId,
      body: json['body'] as String? ?? '',
      type: MessageType.fromWire(json['type'] as String?),
      createdAt: createdAt,
      clientId: ListingMapper.text(json['clientId']),
      readAt: ListingMapper.date(json['readAt']),
    );
  }
}
