import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

/// Five stars, filled to [rating].
///
/// Read-only unless [onRate] is given, in which case each star is a tap
/// target of its own — a slider or a text field would both be worse on a
/// phone held in one hand.
class RatingStars extends StatelessWidget {
  const RatingStars({
    required this.rating,
    this.size = 16,
    this.onRate,
    super.key,
  });

  final num rating;
  final double size;
  final ValueChanged<int>? onRate;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var star = 1; star <= 5; star++)
          if (onRate == null)
            Icon(
              star <= rating ? Icons.star_rounded : Icons.star_outline_rounded,
              size: size,
              color: AppColors.saffron,
            )
          else
            // 44dp, the product's minimum tap target — a mis-tap here is a
            // wrong rating on somebody's permanent record.
            InkResponse(
              onTap: () => onRate!(star),
              radius: 24,
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(
                  star <= rating
                      ? Icons.star_rounded
                      : Icons.star_outline_rounded,
                  size: size,
                  color: AppColors.saffron,
                  semanticLabel: '$star',
                ),
              ),
            ),
      ],
    );
  }
}
