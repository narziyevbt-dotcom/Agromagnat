import 'package:flutter/material.dart';

import '../../../core/localization/app_strings.dart';
import '../../shell/presentation/main_shell.dart';

/// Built out in Prompt 7 (filter chips, filter sheet, sort, results).
class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const PlaceholderScreen(
      title: AppStrings.searchTitle,
      icon: Icons.search_rounded,
    );
  }
}
