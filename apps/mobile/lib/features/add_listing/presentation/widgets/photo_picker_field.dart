import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../listings/domain/entities/draft_photo.dart';
import '../providers/draft_controller.dart';
import 'attribute_fields.dart';

/// Photos on the draft: a strip of thumbnails and a way to add more.
///
/// It sits at the top of the form because a listing with a photo is the one
/// buyers call. Optional all the same — a farmer standing in a field with one
/// bar of signal should be able to post without one, and most do.
class PhotoPickerField extends ConsumerWidget {
  const PhotoPickerField({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photos = ref.watch(draftControllerProvider).draft.photos;
    final controller = ref.read(draftControllerProvider.notifier);
    final slotsLeft = DraftController.maxPhotos - photos.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(
          label: AppStrings.photos,
          hint: photos.isEmpty
              ? AppStrings.photosHint
              : AppStrings.photosCoverHint,
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 104,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final photo in photos)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: _Thumbnail(
                    photo: photo,
                    isCover: photo == photos.first,
                    onRemove: () => controller.removePhoto(photo),
                    onMakeCover: () => controller.makeCover(photo),
                  ),
                ),
              if (slotsLeft > 0) _AddButton(controller: controller),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          slotsLeft > 0
              ? AppStrings.photosRemaining(slotsLeft)
              : AppStrings.photosFull,
          style: AppTypography.body(size: 12, color: AppColors.inkFaint),
        ),
      ],
    );
  }
}

class _Thumbnail extends StatelessWidget {
  const _Thumbnail({
    required this.photo,
    required this.isCover,
    required this.onRemove,
    required this.onMakeCover,
  });

  final DraftPhoto photo;
  final bool isCover;
  final VoidCallback onRemove;
  final VoidCallback onMakeCover;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 104,
      height: 104,
      child: Stack(
        children: [
          Positioned.fill(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              child: Semantics(
                image: true,
                label: isCover ? AppStrings.coverPhoto : AppStrings.photos,
                child: GestureDetector(
                  // Tapping a photo promotes it to cover. Drag-to-reorder is
                  // the usual gesture and a poor fit here: the strip is at
                  // most five items and long-press-drag is not a gesture this
                  // audience reaches for.
                  onTap: isCover ? null : onMakeCover,
                  child: Image.file(
                    File(photo.path),
                    fit: BoxFit.cover,
                    // A file picked a moment ago can still be gone — some
                    // gallery apps hand back a path in a cache the OS clears.
                    errorBuilder: (_, __, ___) => Container(
                      color: AppColors.surfaceSoft,
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.broken_image_outlined,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (isCover)
            Positioned(
              left: AppSpacing.xs,
              bottom: AppSpacing.xs,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.forest,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Text(
                  AppStrings.coverPhoto,
                  style: AppTypography.body(
                    size: 10,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          Positioned(
            top: 0,
            right: 0,
            child: Semantics(
              button: true,
              label: AppStrings.removePhoto,
              child: InkResponse(
                onTap: onRemove,
                radius: 20,
                child: Container(
                  margin: const EdgeInsets.all(2),
                  padding: const EdgeInsets.all(3),
                  decoration: const BoxDecoration(
                    color: Colors.black54,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.close_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.controller});

  final DraftController controller;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: AppStrings.addPhoto,
      child: Material(
        color: AppColors.surfaceSoft,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        child: InkWell(
          onTap: () => _showSource(context),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          child: SizedBox(
            width: 104,
            height: 104,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.add_a_photo_outlined,
                  color: AppColors.inkMuted,
                  size: 26,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  AppStrings.addPhoto,
                  style: AppTypography.body(size: 12, color: AppColors.inkMuted),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showSource(BuildContext context) async {
    // Camera and gallery as an explicit choice rather than one button that
    // guesses. A farmer photographing the crop in front of them wants the
    // camera; one posting last week's harvest wants the gallery.
    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSpacing.sm),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text(AppStrings.takePhoto),
              onTap: () => Navigator.of(sheetContext).pop('camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text(AppStrings.fromGallery),
              onTap: () => Navigator.of(sheetContext).pop('gallery'),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ),
      ),
    );

    switch (source) {
      case 'camera':
        await controller.addFromCamera();
      case 'gallery':
        await controller.addFromGallery();
    }
  }
}
