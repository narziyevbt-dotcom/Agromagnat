import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/localization/app_strings.dart';
import '../../../shared/widgets/app_bottom_nav.dart';
import '../../add_listing/presentation/add_listing_screen.dart';
import '../../home/presentation/home_screen.dart';
import '../../messages/presentation/messages_screen.dart';
import '../../messages/presentation/providers/chat_providers.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../search/presentation/search_screen.dart';

/// Which of the five bar slots is selected.
final shellIndexProvider = StateProvider<int>((ref) => 0);

/// Hosts the four tabbed screens and routes the centre "+" to the add-listing
/// flow. State is kept per tab via [IndexedStack] so switching tabs never loses
/// a scroll position or a half-filled form.
class MainShell extends ConsumerWidget {
  const MainShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(shellIndexProvider);

    return Scaffold(
      body: IndexedStack(
        index: _tabForSlot(index),
        children: const [
          HomeScreen(),
          SearchScreen(),
          MessagesScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: index,
        unread: ref.watch(unreadProvider),
        onTap: (slot) {
          if (slot == AppBottomNav.addSlot) {
            // Posting is a full-screen flow, not a tab — it pushes over the shell.
            Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const AddListingScreen(),
                fullscreenDialog: true,
              ),
            );
            return;
          }
          if (slot == messagesSlot) {
            // Opening the tab is the moment the count is most obviously
            // wrong if it is stale.
            ref.read(unreadProvider.notifier).refresh();
          }
          ref.read(shellIndexProvider.notifier).state = slot;
        },
      ),
    );
  }

  static const int messagesSlot = 3;

  /// Slots 0,1,3,4 map to tabs 0,1,2,3 — slot 2 is the "+" button, never a tab.
  int _tabForSlot(int slot) => slot > AppBottomNav.addSlot ? slot - 1 : slot;
}

/// Shared scaffold for the not-yet-built screens, so the empty shell still
/// looks like the product rather than a debug page.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({
    required this.title,
    required this.icon,
    this.showAppBar = true,
    super.key,
  });

  final String title;
  final IconData icon;

  /// False when the placeholder sits inside a screen that already has a bar —
  /// two stacked app bars is the tell of a half-migrated screen.
  final bool showAppBar;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: showAppBar ? AppBar(title: Text(title)) : null,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 64, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(AppStrings.comingSoon, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
