import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/shell/presentation/main_shell.dart';
import 'package:agromagnat/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shell opens on Home with all five nav slots', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AgromagnatApp()));
    await tester.pump();

    expect(find.text(AppStrings.homeTitle), findsWidgets);
    for (final label in [
      AppStrings.navHome,
      AppStrings.navSearch,
      AppStrings.navMessages,
      AppStrings.navProfile,
    ]) {
      expect(find.text(label), findsOneWidget);
    }
    // The centre slot is the saffron "+", which carries an icon and no label.
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
  });

  testWidgets('tapping a tab switches the visible screen', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AgromagnatApp()));
    await tester.pump();

    await tester.tap(find.text(AppStrings.navSearch));
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.searchTitle), findsWidgets);

    await tester.tap(find.text(AppStrings.navProfile));
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.profileTitle), findsWidgets);
  });

  testWidgets('the "+" slot pushes the add-listing flow, not a tab', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: AgromagnatApp()));
    await tester.pump();

    // Captured before the tap: the pushed full-screen route covers the shell,
    // so MainShell is no longer findable afterwards.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(MainShell)),
    );

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.addTitle), findsWidgets);
    // It is pushed over the shell, so the bar underneath keeps Home selected.
    expect(container.read(shellIndexProvider), 0);
  });
}
