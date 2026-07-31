import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_config.dart';
import '../../../../core/network/api_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/repositories/api_chat_repository.dart';
import '../../data/repositories/mock_chat_repository.dart';
import '../../domain/entities/chat.dart';
import '../../domain/repositories/chat_repository.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  if (!ApiConfig.isConfigured) {
    return MockChatRepository();
  }
  return ApiChatRepository(ref.watch(apiClientProvider));
});

/// The signed-in user's id, or the mock's stand-in when there is no API.
///
/// The conversation screen needs it to decide which side of the thread each
/// bubble belongs on, and getting it wrong puts the user's own words in the
/// other person's mouth.
final viewerIdProvider = Provider<String?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user != null) {
    return user.id;
  }
  return ApiConfig.isConfigured ? null : MockChatRepository.mockViewerId;
});

/// The inbox. Refetched whenever the screen is opened rather than cached —
/// a conversation list that is even a minute stale shows a message count that
/// argues with the badge next to it.
final inboxProvider = FutureProvider.autoDispose<List<ChatSummary>>((ref) {
  return ref.watch(chatRepositoryProvider).inbox();
});

/// One conversation's header — who it is with and which listing it is about.
final chatSummaryProvider =
    FutureProvider.autoDispose.family<ChatSummary, String>((ref, chatId) {
  return ref.watch(chatRepositoryProvider).byId(chatId);
});

/// Total unread, for the badge on the bottom bar.
///
/// Polled rather than pushed: the backend has no socket, and a badge that only
/// updates when the inbox is opened is a badge nobody trusts. Sixty seconds is
/// slow enough not to matter on a metered connection.
class UnreadNotifier extends StateNotifier<int> {
  UnreadNotifier(this._repository, {required this.signedIn}) : super(0) {
    if (signedIn) {
      refresh();
    }
  }

  final ChatRepository _repository;
  final bool signedIn;

  Future<void> refresh() async {
    if (!signedIn) {
      state = 0;
      return;
    }
    try {
      state = await _repository.unreadTotal();
    } on Object {
      // Leave the last known count. A badge that clears itself because the
      // phone lost signal reads as "the messages are gone".
    }
  }
}

final unreadProvider = StateNotifierProvider<UnreadNotifier, int>((ref) {
  return UnreadNotifier(
    ref.watch(chatRepositoryProvider),
    signedIn: ref.watch(currentUserProvider) != null,
  );
});
