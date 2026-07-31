import 'package:speech_to_text/speech_to_text.dart';

/// Speech to text, on the device.
///
/// Mirrors the decision the web app made: it uses the browser's own
/// `SpeechRecognition` rather than uploading audio. Same reasoning here — it
/// costs nothing, the recording never leaves the handset, and there is no
/// upload to fail on a connection that drops.
///
/// The backend has no transcription endpoint yet, which makes this the only
/// route available. When one lands, a second implementation of this interface
/// is the whole change.
abstract interface class Dictation {
  /// Whether this device can dictate Uzbek.
  ///
  /// Not a given. Android's recogniser has had `uz-UZ` for a while; Apple's
  /// Speech framework does not list Uzbek at all, so on iOS this is expected
  /// to be false and the mic simply does not appear. Typing works either way,
  /// which is why the composer never depends on it.
  Future<bool> isAvailable();

  /// Starts listening, calling [onResult] with the transcript so far.
  Future<void> start({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
  });

  Future<void> stop();

  bool get isListening;
}

class DeviceDictation implements Dictation {
  DeviceDictation({SpeechToText? speech}) : _speech = speech ?? SpeechToText();

  final SpeechToText _speech;

  /// Uzbek, Latin script.
  static const String locale = 'uz_UZ';

  bool _initialised = false;

  @override
  bool get isListening => _speech.isListening;

  @override
  Future<bool> isAvailable() async {
    if (!_initialised) {
      // Also what triggers the microphone permission prompt.
      _initialised = await _speech.initialize(
        onError: (_) {},
        onStatus: (_) {},
      );
    }
    if (!_initialised) {
      return false;
    }

    // Available is not the same as available in Uzbek. A recogniser that only
    // speaks Russian would transcribe an Uzbek sentence into nonsense, which
    // is worse than no mic button.
    final locales = await _speech.locales();
    return locales.any(
      (candidate) => candidate.localeId.toLowerCase().startsWith('uz'),
    );
  }

  @override
  Future<void> start({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
  }) async {
    if (!await isAvailable()) {
      return;
    }

    await _speech.listen(
      onResult: (result) => onResult(result.recognizedWords, result.finalResult),
      listenOptions: SpeechListenOptions(
        localeId: locale,
        // Partial results as they come, so the seller watches the sentence
        // build and knows the mic heard them.
        partialResults: true,
        cancelOnError: true,
        // A listing sentence is one breath, not a monologue. Long enough for
        // "12 tonna pomidor, kilosi 14 ming so'm", short enough that a mic
        // left on in a pocket stops by itself.
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
      ),
    );

    _speech.statusListener = (status) {
      if (status == 'done' || status == 'notListening') {
        onDone();
      }
    };
  }

  @override
  Future<void> stop() => _speech.stop();
}
