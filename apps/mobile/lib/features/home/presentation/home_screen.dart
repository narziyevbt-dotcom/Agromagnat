import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../shell/presentation/main_shell.dart';

/// Built out in Prompt 6 (category grid, market-price card, listing feed).
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: AppStrings.homeTitle,
      icon: Icons.home_rounded,
    );
  }
}
