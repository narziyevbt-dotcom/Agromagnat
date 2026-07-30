import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../shell/presentation/main_shell.dart';

/// Built out in Prompt 12 (chat list and chat screen over WebSocket).
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: AppStrings.messagesTitle,
      icon: Icons.chat_bubble_rounded,
    );
  }
}
