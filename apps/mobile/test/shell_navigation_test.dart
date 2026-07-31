import 'package:agromagnat/core/localization/app_strings.dart';
import 'package:agromagnat/features/listings/presentation/widgets/listing_card.dart';
import 'package:agromagnat/features/shell/presentation/main_shell.dart';
import 'package:agromagnat/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/test_harness.dart';

/// The shell keeps every tab alive in an IndexedStack, so a plain `find.text`
/// also hits widgets on tabs that are not showing. Assertions here go through
/// [shellIndexProvider] instead, which is the state actually being tested.
void main() {
  Future<ProviderContainer> pumpShell(WidgetTester tester) async {
    final container = ProviderContainer(overrides: repositoryOverrides());
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const AgromagnatApp(),
      ),
    );
    await tester.pumpAndSettle();

    return container;
  }

  testWidgets('opens on Home with all five nav slots', (tester) async {
    final container = await pumpShell(tester);

    expect(container.read(shellIndexProvider), 0);
    expect(find.byType(ListingCard), findsWidgets);

    for (final label in [
      AppStrings.navHome,
      AppStrings.navSearch,
      AppStrings.navMessages,
      AppStrings.navProfile,
    ]) {
      expect(find.text(label), findsOneWidget);
    }
    // The centre slot is the lime "+", which carries an icon and no label.
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
  });

  testWidgets('tapping a tab moves the selection', (tester) async {
    final container = await pumpShell(tester);

    await tester.tap(find.text(AppStrings.navSearch));
    await tester.pumpAndSettle();
    expect(container.read(shellIndexProvider), 1);

    await tester.tap(find.text(AppStrings.navProfile));
    await tester.pumpAndSettle();
    expect(container.read(shellIndexProvider), 4);
  });

  testWidgets('the "+" slot pushes the add-listing flow, not a tab',
      (tester) async {
    final container = await pumpShell(tester);

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();

    expect(find.text(AppStrings.addTitle), findsWidgets);
    // It is pushed over the shell, so the bar underneath keeps Home selected.
    expect(container.read(shellIndexProvider), 0);
  });
}
