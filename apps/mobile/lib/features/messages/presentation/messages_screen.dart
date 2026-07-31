import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../../shell/presentation/main_shell.dart';

/// Chat list and chat screen land here, over WebSocket.
class MessagesScreen extends StatelessWidget {
  const MessagesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.messagesTitle)),
      body: const SignInGate(
        reason: AppStrings.signInRequiredMessages,
        icon: Icons.chat_bubble_outline_rounded,
        child: PlaceholderScreen(
          title: AppStrings.messagesTitle,
          icon: Icons.chat_bubble_rounded,
          showAppBar: false,
        ),
      ),
    );
  }
}
