import 'package:agromagnat/core/theme/app_theme.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_catalog_repository.dart';
import 'package:agromagnat/features/listings/data/repositories/mock_listing_repository.dart';
import 'package:agromagnat/features/listings/presentation/providers/listing_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A fixed "now" so relative timestamps are the same on every run.
///
/// Without this a fixture posted "2 soat oldin" drifts across a midnight
/// boundary and a date assertion fails once a day, in CI, for no reason.
final DateTime testNow = DateTime.utc(2026, 7, 31, 12);

/// Repository overrides with the artificial latency removed.
///
/// The delay exists to make loading states visible while developing; in a test
/// it only buys flakes, because every assertion would have to guess how many
/// frames to pump.
List<Override> repositoryOverrides() => [
      catalogRepositoryProvider.overrideWithValue(
        MockCatalogRepository(latency: Duration.zero),
      ),
      listingRepositoryProvider.overrideWithValue(
        MockListingRepository(now: testNow, latency: Duration.zero),
      ),
    ];

/// Pumps [child] inside the app's real theme and a scoped container.
///
/// Tests run against the production ThemeData on purpose: a widget that reads
/// a colour or a text style from the theme should be exercised with the same
/// values the user gets.
Future<ProviderContainer> pumpApp(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
  final container = ProviderContainer(
    overrides: [...repositoryOverrides(), ...overrides],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('uz'),
        home: child,
      ),
    ),
  );
  await tester.pumpAndSettle();

  return container;
}
