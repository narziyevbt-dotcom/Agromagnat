import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../../shell/presentation/main_shell.dart';

/// The 4-step posting flow lands here. Gated first: a listing has to belong to
/// a verified phone number, or the marketplace fills with numbers nobody
/// answers.
class AddListingScreen extends StatelessWidget {
  const AddListingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.addTitle)),
      body: const SignInGate(
        reason: AppStrings.signInRequiredAdd,
        icon: Icons.add_circle_outline_rounded,
        child: PlaceholderScreen(
          title: AppStrings.addTitle,
          icon: Icons.add_circle_rounded,
          showAppBar: false,
        ),
      ),
    );
  }
}
