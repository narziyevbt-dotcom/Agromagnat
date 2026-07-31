import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';
import 'chat_providers.dart';

@immutable
class ConversationState {
  const ConversationState({
    this.messages = const [],
    this.loading = true,
    this.failed = false,
    this.sending = false,
    this.olderCursor,
    this.loadingOlder = false,
  });

  /// Oldest first — the order they are read in, and the order the list paints
  /// bottom-anchored.
  final List<ChatMessage> messages;

  final bool loading;
  final bool failed;
  final bool sending;

  /// Where the next page of *older* messages starts, or null at the beginning
  /// of the conversation.
  final String? olderCursor;

  final bool loadingOlder;

  bool get hasOlder => olderCursor != null;

  ConversationState copyWith({
    List<ChatMessage>? messages,
    bool? loading,
    bool? failed,
    bool? sending,
    Object? olderCursor = _unset,
    bool? loadingOlder,
  }) {
    return ConversationState(
      messages: messages ?? this.messages,
      loading: loading ?? this.loading,
      failed: failed ?? this.failed,
      sending: sending ?? this.sending,
      olderCursor:
          olderCursor == _unset ? this.olderCursor : olderCursor as String?,
      loadingOlder: loadingOlder ?? this.loadingOlder,
    );
  }

  static const Object _unset = Object();
}

/// One open conversation.
class ConversationController extends StateNotifier<ConversationState> {
  ConversationController(this._repository, this.chatId, {this.now})
      : super(const ConversationState()) {
    load();
  }

  final ChatRepository _repository;
  final String chatId;

  /// Injected so a queued bubble's timestamp is stable in tests.
  final DateTime Function()? now;

  int _clientIdSeed = 0;

  DateTime get _clock => now?.call() ?? DateTime.now();

  Future<void> load() async {
    try {
      final page = await _repository.messages(chatId);
      // The API returns newest first; the screen reads oldest first.
      final history = page.items.reversed.toList();

      // Anything still on its way is kept: a reload triggered by the poll must
      // not swallow a message the user is watching send.
      final pending = [
        for (final message in state.messages)
          if (message.delivery != MessageDelivery.sent) message,
      ];

      // Older pages already on screen are kept in front of the refreshed
      // newest page. A poll must not throw away history the reader scrolled
      // up to fetch.
      final older = [
        for (final message in state.messages)
          if (message.delivery == MessageDelivery.sent &&
              !history.any((fresh) => fresh.id == message.id) &&
              // Not `isBefore`: a burst of messages can share a timestamp to
              // the second, and the ones on the boundary would be dropped.
              (history.isEmpty ||
                  !message.createdAt.isAfter(history.first.createdAt)))
            message,
      ];

      state = state.copyWith(
        messages: [...older, ...history, ...pending],
        loading: false,
        failed: false,
        // Only set on the first load: a poll returns the newest page, whose
        // cursor points at history that is already on screen.
        olderCursor: state.olderCursor ?? page.nextCursor,
      );
      unawaited(_repository.markRead(chatId));
    } on Object {
      state = state.copyWith(
        loading: false,
        // Only if there is nothing on screen. Replacing a conversation with an
        // error page because one poll timed out is the worse outcome.
        failed: state.messages.isEmpty,
      );
    }
  }

  /// Fetches the page before the oldest message on screen.
  Future<void> loadOlder() async {
    final cursor = state.olderCursor;
    if (cursor == null || state.loadingOlder) {
      return;
    }

    state = state.copyWith(loadingOlder: true);
    try {
      final page = await _repository.messages(chatId, cursor: cursor);
      state = state.copyWith(
        messages: [...page.items.reversed, ...state.messages],
        olderCursor: page.nextCursor,
        loadingOlder: false,
      );
    } on Object {
      // Nothing is removed and nothing is said: the reader still has what
      // they had, and they will scroll again.
      state = state.copyWith(loadingOlder: false);
    }
  }

  /// Sends, showing the message immediately.
  ///
  /// The bubble appears the moment it is written, greyed with a clock, and
  /// turns solid when the server has it. Waiting for a round trip on EDGE
  /// before showing anything makes people press send twice.
  Future<bool> send(String body, String senderId) async {
    final text = body.trim();
    if (text.isEmpty || state.sending) {
      return false;
    }

    // Generated here and reused on retry: on EDGE the request often succeeds
    // and the response is what gets lost, and without this the retry delivers
    // the message a second time.
    final clientId = 'c${_clock.microsecondsSinceEpoch}-${_clientIdSeed++}';
    final pending = ChatMessage(
      id: clientId,
      chatId: chatId,
      senderId: senderId,
      body: text,
      createdAt: _clock,
      clientId: clientId,
      delivery: MessageDelivery.sending,
    );

    state = state.copyWith(messages: [...state.messages, pending], sending: true);

    try {
      final sent = await _repository.send(chatId, text, clientId: clientId);
      _replace(clientId, sent);
      state = state.copyWith(sending: false);
      return true;
    } on Object {
      // Kept, not dropped. The words are the user's, and a message that
      // vanishes on send is the failure people stop trusting an app for.
      _replace(clientId, pending.copyWith(delivery: MessageDelivery.failed));
      state = state.copyWith(sending: false);
      return false;
    }
  }

  /// Retries one that failed, under its original client id.
  Future<bool> retry(ChatMessage message) async {
    if (message.delivery != MessageDelivery.failed) {
      return false;
    }
    _replace(
      message.id,
      message.copyWith(delivery: MessageDelivery.sending),
    );

    try {
      final sent = await _repository.send(
        chatId,
        message.body,
        clientId: message.clientId,
      );
      _replace(message.id, sent);
      return true;
    } on Object {
      _replace(message.id, message.copyWith(delivery: MessageDelivery.failed));
      return false;
    }
  }

  void _replace(String id, ChatMessage next) {
    state = state.copyWith(
      messages: [
        for (final message in state.messages)
          if (message.id == id) next else message,
      ],
    );
  }
}

final conversationProvider = StateNotifierProvider.autoDispose
    .family<ConversationController, ConversationState, String>((ref, chatId) {
  return ConversationController(ref.watch(chatRepositoryProvider), chatId);
});
