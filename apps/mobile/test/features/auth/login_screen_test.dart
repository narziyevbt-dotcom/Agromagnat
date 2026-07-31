import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/presentation/login_screen.dart';
import 'package:agromagnat/features/auth/presentation/providers/auth_providers.dart';
import 'package:agromagnat/features/auth/presentation/providers/login_controller.dart';
import 'package:agromagnat/features/auth/presentation/widgets/phone_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/test_harness.dart';

/// Runs [body], then stops the resend countdown.
///
/// That countdown is a periodic Timer living for the code's full five minutes,
/// and flutter_test asserts no timer is pending before teardown gets a chance
/// to dispose the container. `editPhone` is the product's own "abandon this
/// code" path, so the test stops it the same way a user would.
void loginTest(String description, Future<void> Function(WidgetTester) body) {
  testWidgets(description, (tester) async {
    await body(tester);

    final screen = find.byType(LoginScreen);
    if (screen.evaluate().isNotEmpty) {
      ProviderScope.containerOf(tester.element(screen), listen: false)
          .read(loginControllerProvider.notifier)
          .editPhone();
    }
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}

/// What the user actually sees in the field.
///
/// `find.text` is no good here: InputDecorator keeps the hint in the tree at
/// zero opacity, and the hint for this field is a formatted number too.
String fieldText(WidgetTester tester) =>
    tester.widget<EditableText>(find.byType(EditableText).first).controller.text;

void main() {
  Future<void> enterPhone(WidgetTester tester, [String phone = '901234567']) async {
    await tester.enterText(find.byType(TextField), phone);
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppStrings.sendCode));
    await tester.pumpAndSettle();
  }

  group('phone step', () {
    loginTest('formats the number as it is typed', (tester) async {
      await pumpApp(tester, const LoginScreen());

      await tester.enterText(find.byType(TextField), '901234567');
      await tester.pumpAndSettle();

      expect(fieldText(tester), '90 123 45 67');
      // The country code is fixed beside the field rather than being one more
      // thing to mistype.
      expect(find.text('+998'), findsOneWidget);
    });

    loginTest('caps input at nine digits', (tester) async {
      await pumpApp(tester, const LoginScreen());

      await tester.enterText(find.byType(TextField), '9012345678888');
      await tester.pumpAndSettle();

      expect(fieldText(tester), '90 123 45 67');
    });

    loginTest('keeps the button disabled until the number is complete',
        (tester) async {
      await pumpApp(tester, const LoginScreen());

      ElevatedButton button() =>
          tester.widget<ElevatedButton>(find.byType(ElevatedButton));

      expect(button().onPressed, isNull);

      await tester.enterText(find.byType(TextField), '90123');
      await tester.pumpAndSettle();
      expect(button().onPressed, isNull);

      await tester.enterText(find.byType(TextField), '901234567');
      await tester.pumpAndSettle();
      expect(button().onPressed, isNotNull);
    });

    loginTest('moves to the code step and says where the code went',
        (tester) async {
      await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      expect(find.text(AppStrings.codeHeadline), findsOneWidget);
      expect(find.textContaining('+998 90 123 45 67'), findsOneWidget);
    });
  });

  group('code step', () {
    loginTest('signs in on the sixth digit without a second tap', (tester) async {
      final container = await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      await tester.enterText(find.byType(TextField), MockAuthRepository.devCode);
      await tester.pumpAndSettle();

      expect(container.read(isSignedInProvider), isTrue);
    });

    loginTest('a wrong code keeps the user on the code step', (tester) async {
      final container = await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      await tester.enterText(find.byType(TextField), '111111');
      await tester.pumpAndSettle();

      expect(container.read(isSignedInProvider), isFalse);
      expect(find.text("Kod noto'g'ri"), findsOneWidget);
      // One fat-fingered digit must not cost another SMS.
      expect(find.text(AppStrings.codeHeadline), findsOneWidget);
    });

    loginTest('counts down before offering a resend', (tester) async {
      await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      expect(find.text(AppStrings.resendCode), findsNothing);
      expect(find.textContaining('5:00'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining('4:59'), findsOneWidget);
    });

    loginTest('lets the user go back and fix the number', (tester) async {
      await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      await tester.tap(find.text(AppStrings.changeNumber));
      await tester.pumpAndSettle();

      expect(find.text(AppStrings.signInHeadline), findsOneWidget);
      expect(find.text('+998'), findsOneWidget);
    });

    loginTest('accepts only digits', (tester) async {
      await pumpApp(tester, const LoginScreen());
      await enterPhone(tester);

      await tester.enterText(find.byType(TextField), 'ab12cd');
      await tester.pumpAndSettle();

      expect(fieldText(tester), '12');
    });
  });

  loginTest('rate limiting shows the wait instead of a dead button',
      (tester) async {
    await pumpApp(tester, const LoginScreen());

    for (var i = 0; i < 3; i++) {
      await enterPhone(tester);
      await tester.tap(find.text(AppStrings.changeNumber));
      await tester.pumpAndSettle();
    }

    await enterPhone(tester);

    expect(find.textContaining("Juda ko'p urinish"), findsOneWidget);
    expect(find.textContaining(AppStrings.tryAgainIn), findsOneWidget);
  });

  test('the phone formatter groups partial input correctly', () {
    final formatter = UzPhoneInputFormatter();

    String format(String raw) => formatter
        .formatEditUpdate(
          TextEditingValue.empty,
          TextEditingValue(text: raw),
        )
        .text;

    expect(format('9'), '9');
    expect(format('901'), '90 1');
    expect(format('90123'), '90 123');
    expect(format('9012345'), '90 123 45');
    expect(format('901234567'), '90 123 45 67');
    expect(format('90123456789'), '90 123 45 67');
  });
}
