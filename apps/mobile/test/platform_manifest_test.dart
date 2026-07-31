import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Guards over the two native manifests.
///
/// These were written after a release APK shipped that could not make a single
/// request: `INTERNET` was declared only in Flutter's debug and profile
/// manifests, so every debug build worked and the release build looked offline
/// on a phone with full signal. Nothing in the Dart suite could have caught
/// it, and the app itself reported it as "Internet yo'q" — the one message
/// guaranteed to send the user looking at their phone instead of the build.
void main() {
  group('AndroidManifest', () {
    late String manifest;

    setUpAll(() {
      manifest =
          File('android/app/src/main/AndroidManifest.xml').readAsStringSync();
    });

    test('declares INTERNET in the manifest release builds actually use', () {
      expect(
        manifest,
        contains('android.permission.INTERNET'),
        reason: 'without it a release build cannot reach the API at all',
      );
    });

    test('declares the microphone the dictation button needs', () {
      expect(manifest, contains('android.permission.RECORD_AUDIO'));
    });

    test('can see the speech recogniser it asks for', () {
      // Android 11+ package visibility: without the query the recogniser is
      // invisible to the app and the mic button silently does nothing.
      expect(manifest, contains('android.speech.RecognitionService'));
    });
  });

  group('Info.plist', () {
    late String plist;

    setUpAll(() {
      plist = File('ios/Runner/Info.plist').readAsStringSync();
    });

    /// A missing usage description does not fail the build. It crashes the app
    /// at the moment the permission is first asked for, which on iOS is the
    /// hardest kind of problem to find late.
    for (final key in const [
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSSpeechRecognitionUsageDescription',
    ]) {
      test('carries $key', () => expect(plist, contains(key)));
    }

    test('advertises Uzbek, or system sheets come back in English', () {
      expect(plist, contains('CFBundleLocalizations'));
      expect(plist, contains('<string>uz</string>'));
    });
  });
}
