import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/widgets/sign_in_gate.dart';
import '../../domain/entities/review.dart';
import '../providers/review_providers.dart';
import 'rating_stars.dart';

/// Asks for a sign-in if needed, then opens the rating sheet.
///
/// Returns true when a review was left, so the caller can refresh what it
/// shows without guessing.
Future<bool> rateSeller(
  BuildContext context,
  WidgetRef ref,
  String listingId,
) async {
  await ref.read(authControllerProvider.notifier).ready;

  if (!ref.read(isSignedInProvider)) {
    if (!context.mounted) {
      return false;
    }
    if (!await promptSignIn(context)) {
      return false;
    }
  }
  if (!context.mounted) {
    return false;
  }

  final left = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (sheetContext) => Padding(
      // Above the keyboard: the comment field is the second thing tapped.
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
      ),
      child: _RateSheet(listingId: listingId),
    ),
  );

  if (left ?? false) {
    ref.invalidate(myReviewProvider(listingId));
  }
  return left ?? false;
}

class _RateSheet extends ConsumerStatefulWidget {
  const _RateSheet({required this.listingId});

  final String listingId;

  @override
  ConsumerState<_RateSheet> createState() => _RateSheetState();
}

class _RateSheetState extends ConsumerState<_RateSheet> {
  final TextEditingController _comment = TextEditingController();
  int _rating = 0;
  bool _sending = false;
  String? _refusal;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppStrings.rateSeller,
              style: AppTypography.heading(size: 19),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              AppStrings.rateSellerHint,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 13, color: AppColors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.lg),
            Center(
              child: RatingStars(
                rating: _rating,
                size: 36,
                onRate: (value) => setState(() {
                  _rating = value;
                  _refusal = null;
                }),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: _comment,
              minLines: 2,
              maxLines: 4,
              maxLength: 1000,
              textCapitalization: TextCapitalization.sentences,
              style: AppTypography.body(size: 15),
              decoration: const InputDecoration(
                labelText: AppStrings.reviewComment,
                counterText: '',
              ),
            ),
            if (_refusal != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _refusal!,
                style: AppTypography.body(size: 13, color: AppColors.danger),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton(
              // Disabled until a star is picked: a review with no rating is
              // the one thing the API cannot store.
              onPressed: _rating == 0 || _sending ? null : _send,
              child: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.onLime,
                      ),
                    )
                  : const Text(AppStrings.sendReview),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send() async {
    setState(() {
      _sending = true;
      _refusal = null;
    });

    try {
      await ref.read(reviewRepositoryProvider).rate(
            widget.listingId,
            rating: _rating,
            comment: _comment.text,
          );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } on ReviewRefusedException catch (error) {
      // The server's answer, in Uzbek, kept in the sheet rather than thrown
      // at a snackbar: "you already rated this deal" is about what is on
      // screen, and the sheet is what is on screen.
      setState(() {
        _refusal = error.messageUz;
        _sending = false;
      });
    } on Object {
      setState(() {
        _refusal = AppStrings.reviewFailed;
        _sending = false;
      });
    }
  }
}
