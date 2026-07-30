import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../shell/presentation/main_shell.dart';

/// Built out in Prompt 9 — the 4-step flow with the saffron voice banner.
class AddListingScreen extends StatelessWidget {
  const AddListingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: AppStrings.addTitle,
      icon: Icons.add_circle_rounded,
    );
  }
}
