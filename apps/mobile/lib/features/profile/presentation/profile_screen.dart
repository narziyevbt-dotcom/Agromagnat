import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../shell/presentation/main_shell.dart';

/// Built out in Prompt 10 (stats row, my listings, favorites, settings).
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: AppStrings.profileTitle,
      icon: Icons.person_rounded,
    );
  }
}
