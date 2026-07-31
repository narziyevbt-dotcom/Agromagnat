import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/dictation.dart';
import '../../data/mock_ai_repository.dart';
import '../../domain/entities/ai_draft.dart';
import '../../domain/repositories/ai_repository.dart';

/// The seams where the mock and the platform get swapped out.
final aiRepositoryProvider = Provider<AiRepository>((ref) {
  return MockAiRepository();
});

final dictationProvider = Provider<Dictation>((ref) {
  return DeviceDictation();
});

/// Whether this device can dictate Uzbek at all.
///
/// Resolved once and watched by the composer, which hides the mic when it
/// comes back false rather than offering a button that does nothing.
final dictationAvailableProvider = FutureProvider<bool>((ref) {
  return ref.watch(dictationProvider).isAvailable();
});

@immutable
class ComposerState {
  const ComposerState({
    this.text = '',
    this.listening = false,
    this.drafting = false,
    this.draft,
    this.error,
  });

  /// What the seller said or typed.
  final String text;

  final bool listening;
  final bool drafting;

  /// The last draft produced, so the form can show what was filled in.
  final AiDraft? draft;

  /// Uzbek, ready to show.
  final String? error;

  bool get canDraft => text.trim().length >= 4 && !drafting && !listening;

  ComposerState copyWith({
    String? text,
    bool? listening,
    bool? drafting,
    Object? draft = _unset,
    Object? error = _unset,
  }) {
    return ComposerState(
      text: text ?? this.text,
      listening: listening ?? this.listening,
      drafting: drafting ?? this.drafting,
      draft: draft == _unset ? this.draft : draft as AiDraft?,
      error: error == _unset ? this.error : error as String?,
    );
  }

  static const Object _unset = Object();
}

/// Drives the one sentence a seller speaks or types, and the draft it becomes.
class ComposerController extends StateNotifier<ComposerState> {
  ComposerController(this._ai, this._dictation) : super(const ComposerState());

  final AiRepository _ai;
  final Dictation _dictation;

  void setText(String value) =>
      state = state.copyWith(text: value, error: null);

  Future<void> toggleDictation() async {
    if (state.listening) {
      await _dictation.stop();
      state = state.copyWith(listening: false);
      return;
    }

    state = state.copyWith(listening: true, error: null, text: '');

    await _dictation.start(
      onResult: (transcript, isFinal) {
        // Partial results replace rather than append — the recogniser hands
        // back the whole sentence each time, refined.
        state = state.copyWith(text: transcript);
      },
      onDone: () {
        if (mounted) {
          state = state.copyWith(listening: false);
        }
      },
    );
  }

  /// Sends the sentence for a draft. Returns it, or null on failure.
  Future<AiDraft?> requestDraft() async {
    if (!state.canDraft) {
      return null;
    }
    state = state.copyWith(drafting: true, error: null, draft: null);

    try {
      final draft = await _ai.draftListing(state.text.trim());

      if (draft.isEmpty) {
        state = state.copyWith(
          drafting: false,
          error: "Gapdan ma'lumot ajratib bo'lmadi. Qo'lda to'ldiring",
        );
        return null;
      }

      state = state.copyWith(drafting: false, draft: draft);
      return draft;
    } on AiRateLimitException catch (error) {
      state = state.copyWith(drafting: false, error: error.messageUz);
      return null;
    } on Object {
      // Typing still works, and saying so is the useful half of this message.
      state = state.copyWith(
        drafting: false,
        error: "Yordamchi javob bermadi. Formani qo'lda to'ldiring",
      );
      return null;
    }
  }

  void dismissDraft() => state = state.copyWith(draft: null);
}

final composerControllerProvider =
    StateNotifierProvider.autoDispose<ComposerController, ComposerState>((ref) {
  return ComposerController(
    ref.watch(aiRepositoryProvider),
    ref.watch(dictationProvider),
  );
});
