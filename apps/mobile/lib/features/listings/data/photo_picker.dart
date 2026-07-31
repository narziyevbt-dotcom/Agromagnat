import 'dart:io';

import 'package:image_picker/image_picker.dart';

import '../domain/entities/draft_photo.dart';

/// How a photo gets onto a draft.
///
/// An interface because `image_picker` talks to a platform channel that does
/// not exist under `flutter test`, and because a fake is the only way to
/// exercise the picking flow at all.
abstract interface class PhotoPicker {
  /// One photo from the camera, or null if the seller backed out.
  Future<DraftPhoto?> takePhoto();

  /// Up to [limit] photos from the gallery.
  Future<List<DraftPhoto>> pickFromGallery({required int limit});
}

/// The real picker.
///
/// The downscaling here is the point, not a nicety. The server accepts 12 MB
/// and resizes to 1280px itself, but the upload is what a farmer on EDGE pays
/// for: a stock camera photo is 3–5 MB and would take minutes, while the same
/// frame at 1280px is around 200 KB. `image_picker` does the resize in native
/// code before the bytes ever reach Dart, so nothing large is ever held in
/// memory either — which matters on the cheap handsets this app targets.
class DevicePhotoPicker implements PhotoPicker {
  DevicePhotoPicker({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  /// Matches the server's `PHOTO_MAX_EDGE`. Sending more pixels than it will
  /// keep is paying for bytes that get thrown away.
  static const double maxEdge = 1280;

  /// JPEG quality. 85 is where the artefacts stop being visible on produce
  /// photos while the file is still a fraction of the original.
  static const int quality = 85;

  @override
  Future<DraftPhoto?> takePhoto() async {
    final file = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: maxEdge,
      maxHeight: maxEdge,
      imageQuality: quality,
    );
    return file == null ? null : _toDraft(file);
  }

  @override
  Future<List<DraftPhoto>> pickFromGallery({required int limit}) async {
    final files = await _picker.pickMultiImage(
      maxWidth: maxEdge,
      maxHeight: maxEdge,
      imageQuality: quality,
      limit: limit,
    );

    return [
      for (final file in files.take(limit)) await _toDraft(file),
    ];
  }

  Future<DraftPhoto> _toDraft(XFile file) async {
    return DraftPhoto(
      path: file.path,
      sizeBytes: await File(file.path).length(),
    );
  }
}
