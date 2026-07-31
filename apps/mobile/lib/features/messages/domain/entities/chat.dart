import 'package:flutter/foundation.dart';

import '../../../listings/domain/entities/units.dart';

/// Which side of a conversation the signed-in user is on.
///
/// The same screen serves both: a farmer is a seller in one thread and a buyer
/// in the next, and the only difference is who the counterpart is.
enum ChatRole {
  buyer,
  seller;

  static ChatRole fromWire(String? value) =>
      value == 'seller' ? ChatRole.seller : ChatRole.buyer;
}

/// The other person in a conversation.
@immutable
class ChatParticipant {
  const ChatParticipant({
    required this.id,
    required this.phone,
    this.name,
    this.isVerified = false,
  });

  final String id;
  final String phone;
  final String? name;
  final bool isVerified;

  /// Falls back to the phone number: a listing can be posted without a name,
  /// and "null" at the top of a conversation is worse than a number the buyer
  /// is about to dial anyway.
  String get displayName => (name == null || name!.trim().isEmpty)
      ? phone
      : name!.trim();
}

/// One conversation, as the viewer sees it.
///
/// Carries the listing's title and price rather than a listing id alone: the
/// inbox has to say *which* listing each thread is about, and fetching a
/// listing per row would be twenty requests on a connection that can barely
/// afford one.
@immutable
class ChatSummary {
  const ChatSummary({
    required this.id,
    required this.listingId,
    required this.listingTitle,
    required this.counterpart,
    required this.role,
    this.listingPhotoUrl,
    this.listingPrice,
    this.listingPriceUnit,
    this.lastMessageText,
    this.lastMessageAt,
    this.unreadCount = 0,
  });

  final String id;
  final String listingId;
  final String listingTitle;
  final String? listingPhotoUrl;
  final num? listingPrice;
  final PriceUnit? listingPriceUnit;

  final ChatParticipant counterpart;
  final ChatRole role;

  final String? lastMessageText;
  final DateTime? lastMessageAt;
  final int unreadCount;

  bool get hasUnread => unreadCount > 0;

  ChatSummary copyWith({
    String? lastMessageText,
    DateTime? lastMessageAt,
    int? unreadCount,
  }) {
    return ChatSummary(
      id: id,
      listingId: listingId,
      listingTitle: listingTitle,
      listingPhotoUrl: listingPhotoUrl,
      listingPrice: listingPrice,
      listingPriceUnit: listingPriceUnit,
      counterpart: counterpart,
      role: role,
      lastMessageText: lastMessageText ?? this.lastMessageText,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ChatSummary &&
      other.id == id &&
      other.lastMessageText == lastMessageText &&
      other.lastMessageAt == lastMessageAt &&
      other.unreadCount == unreadCount;

  @override
  int get hashCode =>
      Object.hash(id, lastMessageText, lastMessageAt, unreadCount);
}

enum MessageType {
  text,
  image,
  system;

  static MessageType fromWire(String? value) => switch (value) {
        'image' => MessageType.image,
        'system' => MessageType.system,
        _ => MessageType.text,
      };
}

/// How far a message has got.
///
/// A message written with no signal is kept and shown greyed with a clock
/// rather than dropped — the same rule the listing outbox follows.
enum MessageDelivery {
  sending,
  sent,
  failed,
}

@immutable
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.body,
    required this.createdAt,
    this.type = MessageType.text,
    this.clientId,
    this.readAt,
    this.delivery = MessageDelivery.sent,
  });

  final String id;
  final String chatId;
  final String senderId;
  final String body;
  final MessageType type;
  final DateTime createdAt;

  /// Generated on this device before sending. The API stores it once, so a
  /// message retried after a timeout is not delivered twice.
  final String? clientId;

  final DateTime? readAt;
  final MessageDelivery delivery;

  bool get isRead => readAt != null;

  ChatMessage copyWith({MessageDelivery? delivery}) => ChatMessage(
        id: id,
        chatId: chatId,
        senderId: senderId,
        body: body,
        type: type,
        createdAt: createdAt,
        clientId: clientId,
        readAt: readAt,
        delivery: delivery ?? this.delivery,
      );

  @override
  bool operator ==(Object other) =>
      other is ChatMessage &&
      other.id == id &&
      other.delivery == delivery &&
      other.readAt == readAt;

  @override
  int get hashCode => Object.hash(id, delivery, readAt);
}
