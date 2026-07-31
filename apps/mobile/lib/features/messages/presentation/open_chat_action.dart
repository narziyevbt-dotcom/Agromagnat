import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_strings.dart';
import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../domain/repositories/chat_repository.dart';
import 'conversation_screen.dart';
import 'providers/chat_providers.dart';

/// Opens the conversation about a listing, asking for a sign-in first.
///
/// One thread per (listing, buyer): tapping "Yozish" a second time lands in
/// the conversation that already exists rather than starting a parallel one
/// the seller would have to answer twice.
Future<void> openChatForListing(
  BuildContext context,
  WidgetRef ref,
  String listingId,
) async {
  // Read, not watched — so the session restore has to be awaited explicitly,
  // or a returning user is asked to sign in again.
  await ref.read(authControllerProvider.notifier).ready;

  if (!ref.read(isSignedInProvider)) {
    if (!context.mounted) {
      return;
    }
    if (!await promptSignIn(context)) {
      return;
    }
  }
  if (!context.mounted) {
    return;
  }

  try {
    final chat = await ref.read(chatRepositoryProvider).openForListing(listingId);
    if (!context.mounted) {
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ConversationScreen(chatId: chat.id),
      ),
    );
    ref.invalidate(inboxProvider);
    await ref.read(unreadProvider.notifier).refresh();
  } on CannotChatWithSelfException {
    // Not a network problem, and not something retrying fixes: it is the
    // seller's own listing.
    if (context.mounted) {
      _say(context, AppStrings.cannotChatWithSelf);
    }
  } on Object {
    if (context.mounted) {
      _say(context, AppStrings.chatOpenFailed);
    }
  }
}

void _say(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}
