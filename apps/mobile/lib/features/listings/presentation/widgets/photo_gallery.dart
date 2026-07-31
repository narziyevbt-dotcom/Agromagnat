import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/entities/listing.dart';

/// The photo strip at the top of a listing.
///
/// Renders nothing at all when there are none. An empty 4:3 grey box would eat
/// the top of the screen on the majority of listings — a farmer posting from a
/// field types faster than they photograph — and push the price below the
/// fold, which is the one thing that has to be visible on arrival.
class PhotoGallery extends StatefulWidget {
  const PhotoGallery({required this.photos, super.key});

  final List<ListingPhoto> photos;

  @override
  State<PhotoGallery> createState() => _PhotoGalleryState();
}

class _PhotoGalleryState extends State<PhotoGallery> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.photos.isEmpty) {
      return const SizedBox.shrink();
    }

    return AspectRatio(
      // Produce is photographed in landscape far more often than not, and 4:3
      // fits a crate of tomatoes without cropping the ends off.
      aspectRatio: 4 / 3,
      child: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _controller,
              itemCount: widget.photos.length,
              onPageChanged: (index) => setState(() => _index = index),
              itemBuilder: (context, index) => ListingPhotoView(
                photo: widget.photos[index],
              ),
            ),
          ),
          if (widget.photos.length > 1)
            Positioned(
              right: AppSpacing.md,
              bottom: AppSpacing.md,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                ),
                child: Text(
                  AppStrings.photoOf(_index + 1, widget.photos.length),
                  style: AppTypography.number(size: 12, color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// One photo, from wherever it happens to live.
///
/// A listing that was just posted still holds on-device paths; one that came
/// back from the API holds URLs. Both reach this widget during a single
/// posting flow, so it handles either rather than making the caller care.
class ListingPhotoView extends StatelessWidget {
  const ListingPhotoView({required this.photo, this.fit = BoxFit.cover, super.key});

  final ListingPhoto photo;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final url = photo.url;
    final isRemote = url.startsWith('http://') || url.startsWith('https://');

    if (!isRemote) {
      return Image.file(
        File(url),
        fit: fit,
        errorBuilder: (_, __, ___) => const _Broken(),
      );
    }

    return Image.network(
      url,
      fit: fit,
      loadingBuilder: (context, child, progress) {
        if (progress == null) {
          return child;
        }
        // A photo on EDGE arrives slowly; a grey block that is obviously
        // loading beats a half-drawn image sliding down the screen.
        return Container(
          color: AppColors.surfaceSoft,
          alignment: Alignment.center,
          child: const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        );
      },
      errorBuilder: (_, __, ___) => const _Broken(),
    );
  }
}

class _Broken extends StatelessWidget {
  const _Broken();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surfaceSoft,
      alignment: Alignment.center,
      child: const Icon(Icons.broken_image_outlined, color: AppColors.inkFaint),
    );
  }
}
