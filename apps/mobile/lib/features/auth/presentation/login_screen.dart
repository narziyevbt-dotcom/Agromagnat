import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/uz_format.dart';
import '../../../core/localization/app_strings.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../data/mock_auth_repository.dart';
import 'providers/login_controller.dart';
import 'widgets/phone_field.dart';

/// Phone, then the code sent to it.
///
/// Two steps in one route rather than two screens: the second step needs the
/// first step's number, and a farmer who mistyped a digit should be one tap
/// from fixing it, not one back-navigation and a re-entry.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _code = TextEditingController();

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginControllerProvider);
    final controller = ref.read(loginControllerProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.signInTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.lg),
          children: [
            Text(
              state.step == LoginStep.phone
                  ? AppStrings.signInHeadline
                  : AppStrings.codeHeadline,
              style: AppTypography.heading(size: 24),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              state.step == LoginStep.phone
                  ? AppStrings.signInHint
                  : '${AppStrings.codeSentTo} ${UzFormat.phone(state.phone)}',
              style: AppTypography.body(size: 14, color: AppColors.inkMuted),
            ),
            const SizedBox(height: AppSpacing.xl),

            if (state.step == LoginStep.phone)
              _PhoneStep(
                controller: _phone,
                state: state,
                onSubmit: () => controller.requestCode(_phone.text),
                onEdit: controller.clearError,
              )
            else
              _CodeStep(
                controller: _code,
                state: state,
                onSubmit: () async {
                  final user = await controller.submitCode(_code.text);
                  if (user != null && context.mounted) {
                    Navigator.of(context).pop(true);
                  }
                },
                onEdit: controller.clearError,
                onResend: () {
                  _code.clear();
                  controller.resend();
                },
                onEditPhone: () {
                  _code.clear();
                  controller.editPhone();
                },
              ),

            const SizedBox(height: AppSpacing.xl),
            Text(
              AppStrings.signInTerms,
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: AppColors.inkFaint),
            ),
          ],
        ),
      ),
    );
  }
}

class _PhoneStep extends StatelessWidget {
  const _PhoneStep({
    required this.controller,
    required this.state,
    required this.onSubmit,
    required this.onEdit,
  });

  final TextEditingController controller;
  final LoginState state;
  final VoidCallback onSubmit;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PhoneField(
          controller: controller,
          enabled: !state.busy,
          errorText: state.error,
          onChanged: (_) => onEdit(),
          onSubmitted: (_) => onSubmit(),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SubmitButton(
          label: AppStrings.sendCode,
          busy: state.busy,
          onPressed: onSubmit,
          listenable: controller,
          // Nine digits is the whole national number — enabling the button
          // before that only buys a round trip that fails validation.
          isEnabled: () => _digits(controller.text).length == 9,
        ),
        if (state.secondsLeft > 0 && state.error != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            '${AppStrings.tryAgainIn} ${_mmss(state.secondsLeft)}',
            textAlign: TextAlign.center,
            style: AppTypography.body(size: 13, color: AppColors.inkMuted),
          ),
        ],
      ],
    );
  }

  static String _digits(String raw) => raw.replaceAll(RegExp(r'\D'), '');
}

class _CodeStep extends StatelessWidget {
  const _CodeStep({
    required this.controller,
    required this.state,
    required this.onSubmit,
    required this.onEdit,
    required this.onResend,
    required this.onEditPhone,
  });

  final TextEditingController controller;
  final LoginState state;
  final VoidCallback onSubmit;
  final VoidCallback onEdit;
  final VoidCallback onResend;
  final VoidCallback onEditPhone;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: controller,
          autofocus: true,
          enabled: !state.busy,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.done,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          textAlign: TextAlign.center,
          style: AppTypography.number(size: 28, color: AppColors.ink),
          onChanged: (value) {
            onEdit();
            // Submit on the sixth digit. The user has nothing else to do on
            // this screen, and an extra tap is an extra thing to get wrong.
            if (value.length == 6) {
              onSubmit();
            }
          },
          onSubmitted: (_) => onSubmit(),
          decoration: InputDecoration(
            hintText: '––––––',
            counterText: '',
            errorText: state.error,
            contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        _SubmitButton(
          label: AppStrings.signIn,
          busy: state.busy,
          onPressed: onSubmit,
          listenable: controller,
          isEnabled: () => controller.text.length == 6,
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(
              onPressed: state.busy ? null : onEditPhone,
              child: const Text(AppStrings.changeNumber),
            ),
            if (state.canResend)
              TextButton(onPressed: onResend, child: const Text(AppStrings.resendCode))
            else
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: Text(
                  '${AppStrings.resendIn} ${_mmss(state.secondsLeft)}',
                  style: AppTypography.body(size: 13, color: AppColors.inkFaint),
                ),
              ),
          ],
        ),
        // The dev backend prints the code instead of sending an SMS, and the
        // mock accepts a fixed one. Saying so beats a tester guessing.
        if (kDebugMode) ...[
          const SizedBox(height: AppSpacing.md),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.surfaceSoft,
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            child: Text(
              '${AppStrings.devCodeHint} ${MockAuthRepository.devCode}',
              textAlign: TextAlign.center,
              style: AppTypography.body(size: 12, color: AppColors.inkMuted),
            ),
          ),
        ],
      ],
    );
  }
}

/// A full-width CTA that stays disabled until the field it watches is complete.
class _SubmitButton extends StatelessWidget {
  const _SubmitButton({
    required this.label,
    required this.busy,
    required this.onPressed,
    required this.listenable,
    required this.isEnabled,
  });

  final String label;
  final bool busy;
  final VoidCallback onPressed;
  final Listenable listenable;
  final bool Function() isEnabled;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: listenable,
      builder: (context, _) {
        return ElevatedButton(
          onPressed: busy || !isEnabled() ? null : onPressed,
          child: busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.onLime,
                  ),
                )
              : Text(label),
        );
      },
    );
  }
}

String _mmss(int seconds) {
  final minutes = seconds ~/ 60;
  final rest = seconds % 60;
  return '$minutes:${rest.toString().padLeft(2, '0')}';
}
