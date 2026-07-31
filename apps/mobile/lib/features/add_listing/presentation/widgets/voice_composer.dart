import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/localization/app_strings.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../ai/presentation/providers/composer_controller.dart';
import '../providers/draft_controller.dart';

/// Say the listing in one sentence; the form fills itself in.
///
/// The point of the whole product for a seller who does not enjoy typing on a
/// phone. It sits at the top of the form and is entirely skippable — every
/// field below stays exactly as usable as it was.
///
/// The assistant **fills, it never posts**. Publishing stays a separate,
/// deliberate tap through the ordinary validation, because a listing carries a
/// price and a phone number and a model that can publish one unattended is a
/// model that can misprice somebody's harvest in public.
class VoiceComposer extends ConsumerStatefulWidget {
  const VoiceComposer({super.key});

  @override
  ConsumerState<VoiceComposer> createState() => _VoiceComposerState();
}

class _VoiceComposerState extends ConsumerState<VoiceComposer> {
  final TextEditingController _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(composerControllerProvider);
    final composer = ref.read(composerControllerProvider.notifier);

    // Dictation is speaking into the same box, so the field has to follow it.
    if (state.listening && _controller.text != state.text) {
      _controller.value = TextEditingValue(
        text: state.text,
        selection: TextSelection.collapsed(offset: state.text.length),
      );
    }

    final micAvailable =
        ref.watch(dictationAvailableProvider).valueOrNull ?? false;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.mint,
        borderRadius: BorderRadius.circular(AppSpacing.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, size: 18, color: AppColors.harvest),
              const SizedBox(width: AppSpacing.sm),
              Text(
                AppStrings.composerTitle,
                style: AppTypography.heading(size: 16, color: AppColors.harvest),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            AppStrings.composerHint,
            style: AppTypography.body(size: 13, color: AppColors.inkMuted),
          ),
          const SizedBox(height: AppSpacing.md),

          TextField(
            controller: _controller,
            maxLines: 3,
            minLines: 2,
            enabled: !state.listening && !state.drafting,
            textCapitalization: TextCapitalization.sentences,
            style: AppTypography.body(size: 15),
            decoration: InputDecoration(
              hintText: AppStrings.composerPlaceholder,
              filled: true,
              fillColor: AppColors.surface,
            ),
            onChanged: composer.setText,
          ),

          if (state.listening) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  AppStrings.listening,
                  style: AppTypography.body(size: 13, color: AppColors.harvest),
                ),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              // Absent, not disabled, where the device cannot dictate Uzbek —
              // Apple's recogniser does not list it at all. A button that
              // explains why it will not work is worse than no button.
              if (micAvailable) ...[
                _MicButton(
                  listening: state.listening,
                  onTap: composer.toggleDictation,
                ),
                const SizedBox(width: AppSpacing.sm),
              ],
              Expanded(
                child: ElevatedButton(
                  onPressed: state.canDraft ? () => _fill(composer) : null,
                  child: state.drafting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.onLime,
                          ),
                        )
                      : const Text(AppStrings.fillForm),
                ),
              ),
            ],
          ),

          if (state.error != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              state.error!,
              style: AppTypography.body(size: 12, color: AppColors.danger),
            ),
          ],

          if (state.draft != null) ...[
            const SizedBox(height: AppSpacing.md),
            _AppliedNotice(missing: state.draft!.missingUz),
          ],

          const SizedBox(height: AppSpacing.sm),
          Text(
            AppStrings.aiNeverPublishes,
            style: AppTypography.body(size: 11, color: AppColors.inkFaint),
          ),
        ],
      ),
    );
  }

  Future<void> _fill(ComposerController composer) async {
    final draft = await composer.requestDraft();
    if (draft == null || !mounted) {
      return;
    }
    ref.read(draftControllerProvider.notifier).applyAiDraft(draft);
  }
}

/// What went in, and what the seller still has to supply.
///
/// The second half matters more. `missingUz` is where "I don't know" goes, so
/// the assistant never has to invent a price — but only if the seller is told
/// what is still empty.
class _AppliedNotice extends StatelessWidget {
  const _AppliedNotice({required this.missing});

  final List<String> missing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.check_circle_rounded,
                size: 16,
                color: AppColors.harvest,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  AppStrings.draftApplied,
                  style: AppTypography.body(size: 13, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (missing.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              AppStrings.stillNeeded,
              style: AppTypography.body(size: 12, color: AppColors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.xs),
            for (final item in missing)
              Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(
                  '• $item',
                  style: AppTypography.body(size: 12, color: AppColors.inkMuted),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _MicButton extends StatelessWidget {
  const _MicButton({required this.listening, required this.onTap});

  final bool listening;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: listening ? AppStrings.stopDictation : AppStrings.startDictation,
      child: Material(
        color: listening ? AppColors.danger : AppColors.forest,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: AppSpacing.primaryButtonHeight,
            height: AppSpacing.primaryButtonHeight,
            child: Icon(
              listening ? Icons.stop_rounded : Icons.mic_rounded,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
