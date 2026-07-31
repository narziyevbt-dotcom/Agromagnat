import '../../../../core/pagination/paginated.dart';
import '../../../listings/data/fixtures/listing_fixtures.dart';
import '../../../listings/domain/entities/units.dart';
import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';

/// In-memory conversations over the listing fixtures.
///
/// Threads are real objects with real message lists rather than a fixed
/// screenshot: sending a message has to move the inbox row to the top and
/// clear the badge, and a mock that ignored that would let both ship broken.
class MockChatRepository implements ChatRepository {
  MockChatRepository({
    DateTime? now,
    this.latency = const Duration(milliseconds: 350),
    this.viewerId = mockViewerId,
  }) : _now = now ?? DateTime.now() {
    _seed();
  }

  /// Who the signed-in user is here — the same seller the listing mock posts
  /// as, so "Mening e'lonlarim" and the inbox agree about whose listing it is.
  static const String mockViewerId = 'sel-1';

  final Duration latency;
  final String viewerId;
  final DateTime _now;

  final List<ChatSummary> _chats = [];
  final Map<String, List<ChatMessage>> _messages = {};

  void _seed() {
    final listings = ListingFixtures.build(_now);

    // One where the viewer is the seller — somebody asking about their crop —
    // and one where they are the buyer. Both cases are on screen from the
    // first frame because they render differently.
    final own = listings.firstWhere(
      (listing) => listing.seller.id == viewerId,
      orElse: () => listings.first,
    );
    final other = listings.firstWhere(
      (listing) => listing.seller.id != viewerId,
      orElse: () => listings.last,
    );

    _add(
      id: 'chat-1',
      listingId: own.id,
      title: own.title,
      price: own.price,
      priceUnit: own.priceUnit,
      counterpart: const ChatParticipant(
        id: 'usr-9',
        phone: '998935558811',
        name: 'Nodira Karimova',
        isVerified: true,
      ),
      role: ChatRole.seller,
      unread: 2,
      messages: [
        ('usr-9', 'Assalomu alaykum. Narxi kelishiladimi?', 40),
        (viewerId, "Va alaykum assalom. 10 tonnadan ko'p olsangiz kelishamiz.", 34),
        ('usr-9', "Ertaga o'zim borib ko'rsam bo'ladimi?", 12),
        ('usr-9', 'Manzilni yuboring iltimos', 8),
      ],
    );

    _add(
      id: 'chat-2',
      listingId: other.id,
      title: other.title,
      price: other.price,
      priceUnit: other.priceUnit,
      counterpart: ChatParticipant(
        id: other.seller.id,
        phone: other.seller.phone,
        name: other.seller.name,
        isVerified: other.seller.isVerified,
      ),
      role: ChatRole.buyer,
      unread: 0,
      messages: [
        (viewerId, 'Salom. Qancha qoldi?', 120),
        (other.seller.id, "Hozircha hammasi bor. Nechta kerak?", 118),
      ],
    );
  }

  void _add({
    required String id,
    required String listingId,
    required String title,
    required num price,
    required PriceUnit priceUnit,
    required ChatParticipant counterpart,
    required ChatRole role,
    required int unread,
    required List<(String, String, int)> messages,
  }) {
    final built = <ChatMessage>[
      for (var i = 0; i < messages.length; i++)
        ChatMessage(
          id: '$id-m$i',
          chatId: id,
          senderId: messages[i].$1,
          body: messages[i].$2,
          createdAt: _now.subtract(Duration(minutes: messages[i].$3)),
        ),
    ];

    _messages[id] = built;
    _chats.add(
      ChatSummary(
        id: id,
        listingId: listingId,
        listingTitle: title,
        listingPrice: price,
        listingPriceUnit: priceUnit,
        counterpart: counterpart,
        role: role,
        lastMessageText: built.last.body,
        lastMessageAt: built.last.createdAt,
        unreadCount: unread,
      ),
    );
  }

  @override
  Future<List<ChatSummary>> inbox() async {
    await Future<void>.delayed(latency);
    final sorted = [..._chats]..sort(
        (a, b) => (b.lastMessageAt ?? DateTime(0))
            .compareTo(a.lastMessageAt ?? DateTime(0)),
      );
    return sorted;
  }

  @override
  Future<ChatSummary> openForListing(String listingId) async {
    await Future<void>.delayed(latency);

    for (final chat in _chats) {
      if (chat.listingId == listingId) {
        return chat;
      }
    }

    final listing = ListingFixtures.build(_now)
        .where((candidate) => candidate.id == listingId)
        .firstOrNull;
    if (listing == null) {
      throw StateError('no listing $listingId');
    }
    if (listing.seller.id == viewerId) {
      throw const CannotChatWithSelfException();
    }

    final id = 'chat-${_chats.length + 1}';
    _messages[id] = [];
    final chat = ChatSummary(
      id: id,
      listingId: listing.id,
      listingTitle: listing.title,
      listingPrice: listing.price,
      listingPriceUnit: listing.priceUnit,
      counterpart: ChatParticipant(
        id: listing.seller.id,
        phone: listing.seller.phone,
        name: listing.seller.name,
        isVerified: listing.seller.isVerified,
      ),
      role: ChatRole.buyer,
    );
    _chats.add(chat);
    return chat;
  }

  @override
  Future<ChatSummary> byId(String chatId) async {
    await Future<void>.delayed(latency);
    return _chats.firstWhere((chat) => chat.id == chatId);
  }

  @override
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor}) async {
    await Future<void>.delayed(latency);
    // Newest first, the way the API returns them.
    final all = [...(_messages[chatId] ?? const <ChatMessage>[])].reversed.toList();
    return Paginated<ChatMessage>(items: all);
  }

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) async {
    await Future<void>.delayed(latency);

    final existing = _messages[chatId] ?? [];

    // Idempotent, like the API: a retry after a lost response returns the
    // message already stored rather than adding a second one.
    if (clientId != null) {
      for (final message in existing) {
        if (message.clientId == clientId) {
          return message;
        }
      }
    }

    final message = ChatMessage(
      id: '$chatId-m${existing.length}',
      chatId: chatId,
      senderId: viewerId,
      body: body,
      createdAt: _now,
      clientId: clientId,
    );
    _messages[chatId] = [...existing, message];
    _touch(chatId, message);
    return message;
  }

  @override
  Future<void> markRead(String chatId) async {
    _replace(chatId, (chat) => chat.copyWith(unreadCount: 0));
  }

  @override
  Future<int> unreadTotal() async {
    return _chats.fold<int>(0, (sum, chat) => sum + chat.unreadCount);
  }

  void _touch(String chatId, ChatMessage message) {
    _replace(
      chatId,
      (chat) => chat.copyWith(
        lastMessageText: message.body,
        lastMessageAt: message.createdAt,
      ),
    );
  }

  void _replace(String chatId, ChatSummary Function(ChatSummary) change) {
    final index = _chats.indexWhere((chat) => chat.id == chatId);
    if (index != -1) {
      _chats[index] = change(_chats[index]);
    }
  }
}
