import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/state_views.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../domain/entities/chat.dart';
import 'conversation_screen.dart';
import 'providers/chat_providers.dart';

/// The inbox.
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.messagesTitle)),
      body: const SignInGate(
        reason: AppStrings.signInRequiredMessages,
        icon: Icons.chat_bubble_outline_rounded,
        child: _Inbox(),
      ),
    );
  }
}

class _Inbox extends ConsumerWidget {
  const _Inbox();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxProvider);

    return inbox.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, __) => ErrorView(onRetry: () => ref.invalidate(inboxProvider)),
      data: (chats) {
        if (chats.isEmpty) {
          return const EmptyView(
            title: AppStrings.inboxEmpty,
            hint: AppStrings.inboxEmptyHint,
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(inboxProvider),
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            itemCount: chats.length,
            separatorBuilder: (_, __) => const Divider(
              height: 1,
              indent: AppSpacing.lg + 52,
              color: AppColors.hairline,
            ),
            itemBuilder: (context, index) => _ChatRow(chat: chats[index]),
          ),
        );
      },
    );
  }
}

class _ChatRow extends ConsumerWidget {
  const _ChatRow({required this.chat});

  final ChatSummary chat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
      leading: _Avatar(chat: chat),
      title: Row(
        children: [
          Expanded(
            child: Text(
              chat.counterpart.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.body(
                size: 15,
                weight: chat.hasUnread ? FontWeight.w700 : FontWeight.w600,
              ),
            ),
          ),
          if (chat.counterpart.isVerified) ...[
            const SizedBox(width: AppSpacing.xs),
            const Icon(
              Icons.verified_rounded,
              size: 14,
              color: AppColors.turquoise,
            ),
          ],
          if (chat.lastMessageAt != null) ...[
            const SizedBox(width: AppSpacing.sm),
            Text(
              UzFormat.timeAgo(chat.lastMessageAt!),
              style: AppTypography.body(size: 12, color: AppColors.inkFaint),
            ),
          ],
        ],
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 2),
          // Which listing this is about, always. A seller with four lots on
          // the market cannot answer "qancha qoldi?" without it.
          Text(
            chat.listingTitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.body(size: 12, color: AppColors.harvest),
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Expanded(
                child: Text(
                  chat.lastMessageText ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.body(
                    size: 13,
                    color: chat.hasUnread ? AppColors.ink : AppColors.inkMuted,
                    weight: chat.hasUnread ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              if (chat.hasUnread) ...[
                const SizedBox(width: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.harvest,
                    borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                  ),
                  child: Text(
                    '${chat.unreadCount}',
                    style: AppTypography.number(
                      size: 11,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ConversationScreen(chatId: chat.id),
          ),
        );
        // Coming back: this row's count and the bottom-bar badge are both
        // stale, and a badge that argues with the list is worse than no badge.
        ref.invalidate(inboxProvider);
        await ref.read(unreadProvider.notifier).refresh();
      },
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.chat});

  final ChatSummary chat;

  @override
  Widget build(BuildContext context) {
    final photo = chat.listingPhotoUrl;
    final name = chat.counterpart.displayName;

    return SizedBox(
      width: 44,
      height: 44,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: photo == null
            ? Container(
                color: AppColors.mint,
                alignment: Alignment.center,
                child: Text(
                  name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                  style: AppTypography.heading(
                    size: 16,
                    color: AppColors.harvest,
                  ),
                ),
              )
            : Image.network(
                photo,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(color: AppColors.mint),
              ),
      ),
    );
  }
}
