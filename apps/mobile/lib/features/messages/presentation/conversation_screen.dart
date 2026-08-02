import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/state_views.dart';
import '../../add_listing/presentation/providers/draft_controller.dart'
    show photoPickerProvider;
import '../../listings/presentation/listing_detail_screen.dart';
import '../domain/entities/chat.dart';
import 'providers/chat_providers.dart';
import 'providers/conversation_controller.dart';

/// One conversation.
///
/// Every thread is about a listing, so the listing sits pinned at the top and
/// stays there: "qancha qoldi?" is unanswerable without knowing which lot is
/// being asked about, and a seller with four on the market has four threads
/// that otherwise look identical.
class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({required this.chatId, super.key});

  final String chatId;

  /// How often the open conversation refetches.
  ///
  /// Polled because the backend has no socket. Ten seconds is a compromise:
  /// often enough that a reply lands while you are looking at the screen,
  /// rare enough not to matter on a metered connection.
  static const Duration pollInterval = Duration(seconds: 10);

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final TextEditingController _input = TextEditingController();
  final ScrollController _scroll = ScrollController();
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _poll = Timer.periodic(
      ConversationScreen.pollInterval,
      (_) => ref.read(conversationProvider(widget.chatId).notifier).load(),
    );
    // The list is reversed, so "scrolled to the end" is the top of the
    // conversation — where older messages belong.
    _scroll.addListener(() {
      if (_scroll.position.pixels >=
          _scroll.position.maxScrollExtent - 200) {
        ref.read(conversationProvider(widget.chatId).notifier).loadOlder();
      }
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chat = ref.watch(chatSummaryProvider(widget.chatId));
    final state = ref.watch(conversationProvider(widget.chatId));
    final viewerId = ref.watch(viewerIdProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          chat.valueOrNull?.counterpart.displayName ?? AppStrings.messagesTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: Column(
        children: [
          if (chat.valueOrNull != null) _ListingBar(chat: chat.value!),
          Expanded(
            child: _Messages(
              state: state,
              viewerId: viewerId,
              scroll: _scroll,
              onRetry: (message) => ref
                  .read(conversationProvider(widget.chatId).notifier)
                  .retry(message),
              onReload: () =>
                  ref.read(conversationProvider(widget.chatId).notifier).load(),
            ),
          ),
          _Composer(
            controller: _input,
            sending: state.sending,
            onSend: viewerId == null ? null : () => _send(viewerId),
            onAttach: viewerId == null ? null : () => _attach(viewerId),
          ),
        ],
      ),
    );
  }

  Future<void> _send(String viewerId) async {
    final text = _input.text;
    if (text.trim().isEmpty) {
      return;
    }
    // Cleared immediately: the bubble is already on screen, and leaving the
    // text in the box as well makes it look like nothing happened.
    _input.clear();

    await ref
        .read(conversationProvider(widget.chatId).notifier)
        .send(text, viewerId);
    _scrollToEnd();
  }

  /// Picks a photo and sends it.
  ///
  /// Gallery only, no camera sheet: in a conversation the photo being sent is
  /// almost always one already taken of the crop, and an extra choice in front
  /// of it costs a tap every time.
  Future<void> _attach(String viewerId) async {
    final photos = await ref.read(photoPickerProvider).pickFromGallery(limit: 1);
    if (photos.isEmpty) {
      return;
    }

    await ref
        .read(conversationProvider(widget.chatId).notifier)
        .sendPhoto(photos.first, viewerId);
    _scrollToEnd();
  }

  /// Back to the newest message. Zero, not maxScrollExtent: the list is
  /// reversed, so the newest is at offset 0.
  void _scrollToEnd() {
    if (!_scroll.hasClients) {
      return;
    }
    _scroll.animateTo(
      0,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
    );
  }
}

class _ListingBar extends StatelessWidget {
  const _ListingBar({required this.chat});

  final ChatSummary chat;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.mint,
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ListingDetailScreen(id: chat.listingId),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      chat.listingTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.body(
                        size: 14,
                        weight: FontWeight.w600,
                      ),
                    ),
                    if (chat.listingPrice != null &&
                        chat.listingPriceUnit != null)
                      Text(
                        UzFormat.price(
                          chat.listingPrice!,
                          chat.listingPriceUnit!,
                        ),
                        style: AppTypography.number(
                          size: 13,
                          weight: FontWeight.w700,
                          color: AppColors.harvest,
                        ),
                      ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.harvest),
            ],
          ),
        ),
      ),
    );
  }
}

class _Messages extends StatelessWidget {
  const _Messages({
    required this.state,
    required this.viewerId,
    required this.scroll,
    required this.onRetry,
    required this.onReload,
  });

  final ConversationState state;
  final String? viewerId;
  final ScrollController scroll;
  final void Function(ChatMessage) onRetry;
  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    if (state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (state.failed) {
      return ErrorView(onRetry: onReload);
    }
    if (state.messages.isEmpty) {
      return const EmptyView(
        title: AppStrings.conversationEmpty,
        hint: AppStrings.conversationEmptyHint,
      );
    }

    // Reversed, which does two things at once: the conversation opens on the
    // newest message the way every chat app does, and prepending older
    // history does not jerk the reader's position — the old list opened on
    // the oldest message and made you scroll down to find out what was said.
    return ListView.builder(
      controller: scroll,
      reverse: true,
      padding: const EdgeInsets.all(AppSpacing.lg),
      itemCount: state.messages.length + (state.loadingOlder ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= state.messages.length) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.md),
            child: Center(
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        }

        final message = state.messages[state.messages.length - 1 - index];
        return _Bubble(
          message: message,
          mine: message.senderId == viewerId,
          onRetry: () => onRetry(message),
        );
      },
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.message,
    required this.mine,
    required this.onRetry,
  });

  final ChatMessage message;
  final bool mine;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final failed = message.delivery == MessageDelivery.failed;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment:
            mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.78,
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: mine ? AppColors.mint : AppColors.surface,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              border: mine
                  ? null
                  : Border.all(color: AppColors.hairline),
            ),
            child: message.type == MessageType.image
                ? _PhotoBubble(message: message)
                : Text(
                    message.body,
                    style: AppTypography.body(
                      size: 15,
                      // Greyed while in flight, so a message that has not left
                      // the phone never looks like one that has.
                      color: message.delivery == MessageDelivery.sending
                          ? AppColors.inkFaint
                          : AppColors.ink,
                    ),
                  ),
          ),
          const SizedBox(height: 2),
          if (failed)
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 14),
              label: const Text(AppStrings.messageRetry),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.danger,
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 32),
                textStyle: AppTypography.body(size: 12),
              ),
            )
          else
            Row(
              mainAxisAlignment:
                  mine ? MainAxisAlignment.end : MainAxisAlignment.start,
              children: [
                Text(
                  UzFormat.timeAgo(message.createdAt),
                  style: AppTypography.body(size: 11, color: AppColors.inkFaint),
                ),
                if (mine && message.delivery == MessageDelivery.sending) ...[
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.schedule_rounded,
                    size: 11,
                    color: AppColors.inkFaint,
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

/// A photo in a conversation.
///
/// The body is an on-device path until the server answers with a URL, so both
/// are rendered — the same thing `ListingPhotoView` does for a listing that
/// was posted moments ago.
class _PhotoBubble extends StatelessWidget {
  const _PhotoBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final local = !message.body.startsWith('http');

    return Opacity(
      // Faded while it uploads, for the same reason text is greyed: a photo
      // that has not left the phone must not look like one that has.
      opacity: message.delivery == MessageDelivery.sending ? 0.5 : 1,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 260),
          child: local
              ? Image.file(File(message.body), fit: BoxFit.cover)
              : Image.network(
                  message.body,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    width: 160,
                    height: 120,
                    color: AppColors.surfaceSoft,
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.broken_image_outlined,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.onSend,
    required this.onAttach,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback? onSend;
  final VoidCallback? onAttach;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                onPressed: sending ? null : onAttach,
                tooltip: AppStrings.attachPhoto,
                icon: const Icon(Icons.image_outlined, size: 22),
                color: AppColors.inkMuted,
              ),
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  // Grows to four lines and then scrolls: a farmer describing
                  // delivery writes more than one line, and a single-line box
                  // hides what they already typed.
                  maxLines: 4,
                  maxLength: 2000,
                  textCapitalization: TextCapitalization.sentences,
                  style: AppTypography.body(size: 15),
                  decoration: const InputDecoration(
                    hintText: AppStrings.messageHint,
                    counterText: '',
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              IconButton.filled(
                onPressed: sending ? null : onSend,
                icon: const Icon(Icons.send_rounded, size: 20),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.lime,
                  foregroundColor: AppColors.onLime,
                  minimumSize: const Size(48, 48),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
