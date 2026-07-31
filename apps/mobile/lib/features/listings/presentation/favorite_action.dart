import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/providers/auth_providers.dart';
import '../../auth/presentation/widgets/sign_in_gate.dart';
import '../domain/entities/listing.dart';
import 'providers/listing_providers.dart';

/// Saves or unsaves a listing, asking for a sign-in first if there isn't one.
///
/// Saved listings belong to an account — they have to survive a reinstall and
/// follow the user to the website — so the heart is the first thing in the
/// browsing flow that needs one. On success the toggle runs immediately, so
/// the tap that triggered the login is not lost.
Future<void> toggleFavoriteOrSignIn(
  BuildContext context,
  WidgetRef ref,
  Listing listing,
) async {
  // Reads, not watches — so the restore has to be awaited explicitly or a
  // returning user gets asked to sign in again.
  await ref.read(authControllerProvider.notifier).ready;

  if (!ref.read(isSignedInProvider)) {
    final signedIn = await promptSignIn(context);
    if (!signedIn) {
      return;
    }
  }
  await ref.read(favoritesProvider.notifier).toggle(listing);
}
