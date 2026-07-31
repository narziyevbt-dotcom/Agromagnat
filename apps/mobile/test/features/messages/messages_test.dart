import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/core/pagination/paginated.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/listings/data/fixtures/listing_fixtures.dart';
import 'package:agromagnat/features/messages/data/repositories/mock_chat_repository.dart';
import 'package:agromagnat/features/messages/domain/entities/chat.dart';
import 'package:agromagnat/features/messages/domain/repositories/chat_repository.dart';
import 'package:agromagnat/features/messages/presentation/conversation_screen.dart';
import 'package:agromagnat/features/messages/presentation/messages_screen.dart';
import 'package:agromagnat/features/messages/presentation/providers/chat_providers.dart';
import 'package:agromagnat/features/messages/presentation/providers/conversation_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

/// Sending always dies, the way a phone with no bars does.
class _DeadRepository implements ChatRepository {
  _DeadRepository(this._inner);

  final ChatRepository _inner;
  int attempts = 0;

  /// Flipped mid-test to make a poll fail after the history loaded.
  bool readsFail = false;

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) {
    attempts++;
    return Future.error(Exception('no signal'));
  }

  @override
  Future<List<ChatSummary>> inbox() => _inner.inbox();

  @override
  Future<ChatSummary> openForListing(String listingId) =>
      _inner.openForListing(listingId);

  @override
  Future<ChatSummary> byId(String chatId) => _inner.byId(chatId);

  @override
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor}) =>
      readsFail
          ? Future.error(Exception('no signal'))
          : _inner.messages(chatId, cursor: cursor);

  @override
  Future<void> markRead(String chatId) => _inner.markRead(chatId);

  @override
  Future<int> unreadTotal() => _inner.unreadTotal();
}

/// Refuses the first attempt, then works — one lost response on EDGE.
class _FlakyRepository extends _DeadRepository {
  _FlakyRepository(super.inner);

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) {
    attempts++;
    if (attempts == 1) {
      return Future.error(Exception('timed out'));
    }
    return _inner.send(chatId, body, clientId: clientId);
  }
}

void main() {
  late MockChatRepository repository;

  setUp(() {
    repository = MockChatRepository(now: testNow, latency: Duration.zero);
  });

  Future<ConversationController> open(
    String chatId, {
    ChatRepository? repo,
  }) async {
    final controller = ConversationController(repo ?? repository, chatId);
    await controller.load();
    return controller;
  }

  group('the inbox', () {
    test('is newest first', () async {
      final chats = await repository.inbox();

      expect(chats, hasLength(2));
      expect(
        chats.first.lastMessageAt!.isAfter(chats.last.lastMessageAt!),
        isTrue,
      );
    });

    test('counts unread across every conversation', () async {
      expect(await repository.unreadTotal(), 2);
    });

    test('opening a conversation clears its badge', () async {
      await repository.markRead('chat-1');

      expect(await repository.unreadTotal(), 0);
      expect(
        (await repository.byId('chat-1')).unreadCount,
        0,
      );
    });

    test('says which listing each thread is about', () async {
      // A seller with four lots on the market cannot answer "qancha qoldi?"
      // without it.
      for (final chat in await repository.inbox()) {
        expect(chat.listingTitle, isNotEmpty);
      }
    });
  });

  group('reading a conversation', () {
    test('oldest first, whatever order the API returns', () async {
      final controller = await open('chat-1');
      final messages = controller.state.messages;

      expect(messages, isNotEmpty);
      for (var i = 1; i < messages.length; i++) {
        expect(
          messages[i].createdAt.isBefore(messages[i - 1].createdAt),
          isFalse,
        );
      }
    });

    test('marks it read', () async {
      await open('chat-1');
      expect(await repository.unreadTotal(), 0);
    });
  });

  group('sending', () {
    test('shows the message before the server has it', () async {
      final controller = await open('chat-1');
      final before = controller.state.messages.length;

      final pending = controller.send('Ertaga olib ketaman', 'sel-1');

      expect(controller.state.messages, hasLength(before + 1));
      expect(controller.state.messages.last.delivery, MessageDelivery.sending);

      await pending;
      expect(controller.state.messages.last.delivery, MessageDelivery.sent);
    });

    test('an empty message is not sent', () async {
      final controller = await open('chat-1');
      final before = controller.state.messages.length;

      expect(await controller.send('   ', 'sel-1'), isFalse);
      expect(controller.state.messages, hasLength(before));
    });

    test('a failed message is kept, not dropped', () async {
      final dead = _DeadRepository(repository);
      final controller = await open('chat-1', repo: dead);

      expect(await controller.send('Manzil: Urgut bozori', 'sel-1'), isFalse);

      // The words are the user's. A message that vanishes on send is the
      // failure people stop trusting an app for.
      final last = controller.state.messages.last;
      expect(last.body, 'Manzil: Urgut bozori');
      expect(last.delivery, MessageDelivery.failed);
    });

    test('a retry goes out under the same client id', () async {
      final flaky = _FlakyRepository(repository);
      final controller = await open('chat-1', repo: flaky);

      await controller.send('Narx kelishildi', 'sel-1');
      final failed = controller.state.messages.last;
      expect(failed.delivery, MessageDelivery.failed);

      expect(await controller.retry(failed), isTrue);

      // On EDGE the request often succeeds and the response is what gets
      // lost. Without the client id the retry delivers it twice.
      expect(
        controller.state.messages.where((m) => m.body == 'Narx kelishildi'),
        hasLength(1),
      );
      expect(flaky.attempts, 2);
    });

    test('the same client id twice stores one message', () async {
      final first = await repository.send('chat-2', 'Salom', clientId: 'abc123456');
      final second =
          await repository.send('chat-2', 'Salom', clientId: 'abc123456');

      expect(second.id, first.id);
    });

    test('a poll while a message is in flight does not swallow it', () async {
      final dead = _DeadRepository(repository);
      final controller = await open('chat-1', repo: dead);
      await controller.send('Yuborilmaydi', 'sel-1');

      await controller.load();

      expect(
        controller.state.messages.any((m) => m.body == 'Yuborilmaydi'),
        isTrue,
      );
    });

    test('a failed reload keeps what is already on screen', () async {
      final flaky = _DeadRepository(repository);
      final controller = await open('chat-1', repo: flaky);
      final before = controller.state.messages.length;

      // The ten-second poll fires with no signal. Replacing a conversation
      // with an error page because one poll timed out is the worse outcome.
      flaky.readsFail = true;
      await controller.load();

      expect(controller.state.messages, hasLength(before));
      expect(controller.state.failed, isFalse);
    });

    test('a conversation that never loaded does show the error', () async {
      final controller = ConversationController(_AllDead(), 'chat-1');
      await controller.load();

      expect(controller.state.failed, isTrue);
    });
  });

  group('older history', () {
    test('the newest page comes first, with a cursor behind it', () async {
      repository.seedLongThread('chat-1', 70);
      final controller = await open('chat-1');

      expect(controller.state.messages, hasLength(MockChatRepository.pageSize));
      expect(controller.state.hasOlder, isTrue);

      // The newest page: what a reader opening a thread wants to see.
      expect(controller.state.messages.last.body, contains('Manzilni'));
    });

    test('scrolling up prepends the page before it', () async {
      repository.seedLongThread('chat-1', 70);
      final controller = await open('chat-1');
      final newest = controller.state.messages.first;

      await controller.loadOlder();

      expect(
        controller.state.messages,
        hasLength(MockChatRepository.pageSize * 2),
      );
      // Prepended, not appended: older messages belong above.
      expect(controller.state.messages.last.id, isNot(newest.id));
      expect(
        controller.state.messages.indexWhere((m) => m.id == newest.id),
        MockChatRepository.pageSize,
      );
    });

    test('it stops at the beginning of the conversation', () async {
      repository.seedLongThread('chat-1', 40);
      final controller = await open('chat-1');

      await controller.loadOlder();
      await controller.loadOlder();

      expect(controller.state.hasOlder, isFalse);
    });

    test('a poll does not throw the older pages away', () async {
      repository.seedLongThread('chat-1', 70);
      final controller = await open('chat-1');
      await controller.loadOlder();
      final before = controller.state.messages.length;

      await controller.load();

      // Ten seconds after scrolling up, the poll fires. Losing the history
      // the reader just fetched would send them scrolling again.
      expect(controller.state.messages, hasLength(before));
    });
  });

  group('opening a chat from a listing', () {
    test('twice lands in the same conversation', () async {
      final chats = await repository.inbox();
      final listingId = chats.last.listingId;

      final first = await repository.openForListing(listingId);
      final second = await repository.openForListing(listingId);

      // One thread per (listing, buyer): two would leave the seller answering
      // the same question in two places.
      expect(second.id, first.id);
    });

    test('refuses the seller their own listing', () async {
      final seeded = (await repository.inbox()).map((chat) => chat.listingId);
      final ownListing = ListingFixtures.build(testNow).firstWhere(
            (listing) =>
                listing.seller.id == MockChatRepository.mockViewerId &&
                !seeded.contains(listing.id),
          );

      // The API refuses it, and it deserves its own type: the button should
      // not have been offered, which is not a network problem to retry.
      expect(
        () => repository.openForListing(ownListing.id),
        throwsA(isA<CannotChatWithSelfException>()),
      );
    });
  });

  group('the screens', () {
    Future<void> pumpInbox(WidgetTester tester) async {
      final auth = MockAuthRepository(latency: Duration.zero);
      await pumpApp(
        tester,
        const MessagesScreen(),
        auth: auth,
        tokenStore: await signedIn(tester, auth),
        overrides: [chatRepositoryProvider.overrideWithValue(repository)],
      );
    }

    testWidgets('asks for a sign-in first', (tester) async {
      await pumpApp(tester, const MessagesScreen());

      expect(find.text(AppStrings.signInRequiredMessages), findsOneWidget);
    });

    testWidgets('lists conversations with the listing they are about',
        (tester) async {
      await pumpInbox(tester);

      final chats = await tester.runAsync(repository.inbox);
      expect(find.text(chats!.first.counterpart.displayName), findsOneWidget);
      expect(find.text(chats.first.listingTitle), findsOneWidget);
      expect(find.text('2'), findsOneWidget, reason: 'unread badge');
    });

    testWidgets('opens a conversation and sends', (tester) async {
      await pumpInbox(tester);

      await tester.tap(find.byType(ListTile).first);
      await tester.pumpAndSettle();

      expect(find.byType(ConversationScreen), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Ertaga boraman');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Ertaga boraman'), findsOneWidget);
      // The box is cleared: leaving the text in it as well makes it look like
      // nothing happened.
      expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
          isEmpty);
    });

    testWidgets('a failed send offers a retry, with the words still there',
        (tester) async {
      final auth = MockAuthRepository(latency: Duration.zero);
      await pumpApp(
        tester,
        const ConversationScreen(chatId: 'chat-1'),
        auth: auth,
        tokenStore: await signedIn(tester, auth),
        overrides: [
          chatRepositoryProvider.overrideWithValue(_DeadRepository(repository)),
          viewerIdProvider.overrideWithValue(MockChatRepository.mockViewerId),
        ],
      );

      await tester.enterText(find.byType(TextField), 'Manzilni yuboring');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Manzilni yuboring'), findsOneWidget);
      expect(find.text(AppStrings.messageRetry), findsOneWidget);
    });
  });
}

/// Nothing works at all — a conversation opened with no signal ever.
class _AllDead implements ChatRepository {
  @override
  Future<List<ChatSummary>> inbox() => Future.error(Exception('dead'));

  @override
  Future<ChatSummary> openForListing(String listingId) =>
      Future.error(Exception('dead'));

  @override
  Future<ChatSummary> byId(String chatId) => Future.error(Exception('dead'));

  @override
  Future<Paginated<ChatMessage>> messages(String chatId, {String? cursor}) =>
      Future.error(Exception('dead'));

  @override
  Future<ChatMessage> send(String chatId, String body, {String? clientId}) =>
      Future.error(Exception('dead'));

  @override
  Future<void> markRead(String chatId) => Future.error(Exception('dead'));

  @override
  Future<int> unreadTotal() => Future.error(Exception('dead'));
}
