import 'package:flutter/foundation.dart';

/// A photo chosen on the device, before it belongs to a listing.
///
/// Photos cannot be uploaded until the listing exists — the API takes them at
/// `POST /listings/:id/photos` — so a draft carries file paths and the upload
/// happens straight after create.
@immutable
class DraftPhoto {
  const DraftPhoto({
    required this.path,
    required this.sizeBytes,
  });

  /// Absolute path on the device. Already downscaled by the picker.
  final String path;

  final int sizeBytes;

  /// Roughly what this costs to send, for the seller to see before they do.
  String get sizeLabel {
    if (sizeBytes < 1024) {
      return '$sizeBytes B';
    }
    if (sizeBytes < 1024 * 1024) {
      return '${(sizeBytes / 1024).round()} KB';
    }
    return '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  @override
  bool operator ==(Object other) => other is DraftPhoto && other.path == path;

  @override
  int get hashCode => path.hashCode;
}
