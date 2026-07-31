import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../login_screen.dart';
import '../providers/auth_providers.dart';

/// Opens the login screen and reports whether the user came back signed in.
///
/// Returned rather than handled inside, so the caller can carry on with what
/// the user was actually trying to do — saving a listing, opening the posting
/// form — instead of dropping them on a screen they did not ask for.
Future<bool> promptSignIn(BuildContext context) async {
  final result = await Navigator.of(context).push<bool>(
    MaterialPageRoute<bool>(
      builder: (_) => const LoginScreen(),
      fullscreenDialog: true,
    ),
  );
  return result ?? false;
}

/// Shows [child] to a signed-in user and a reason to sign in to everyone else.
///
/// Browsing stays open to everyone — a farmer should be able to see what
/// tomatoes are fetching before deciding this app is worth an account. Only
/// the parts that write something ask for one.
class SignInGate extends ConsumerWidget {
  const SignInGate({
    required this.reason,
    required this.child,
    this.icon = Icons.lock_outline_rounded,
    super.key,
  });

  /// Why this particular screen needs an account, in the user's terms.
  final String reason;
  final Widget child;
  final IconData icon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(authControllerProvider);

    return switch (state) {
      // Reading the keystore takes a moment on a cold start. Showing the wall
      // during it would flash "sign in" at someone who already is.
      AuthRestoring() => const Center(child: CircularProgressIndicator()),
      AuthSignedIn() => child,
      AuthSignedOut() => _Wall(reason: reason, icon: icon),
    };
  }
}

class _Wall extends StatelessWidget {
  const _Wall({required this.reason, required this.icon});

  final String reason;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppColors.inkFaint),
            const SizedBox(height: AppSpacing.lg),
            Text(
              AppStrings.signInRequired,
              textAlign: TextAlign.center,
              style: AppTypography.heading(size: 18),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              reason,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 14, color: AppColors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.xl),
            SizedBox(
              width: 220,
              child: ElevatedButton(
                onPressed: () => promptSignIn(context),
                child: const Text(AppStrings.signIn),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
