import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'json_cache.dart';

/// The cache, once SharedPreferences has opened.
///
/// Null until then. Everything that reads it treats null as an empty cache,
/// which is the honest reading — on a cold start the disk genuinely has
/// nothing to offer yet, and blocking the first frame on a plugin channel to
/// find that out costs more than it saves.
final jsonCacheProvider = StateProvider<JsonCache?>((ref) => null);

/// Opens the store and publishes it. Called once from main().
Future<void> initCache(ProviderContainer container) async {
  final prefs = await SharedPreferences.getInstance();
  container.read(jsonCacheProvider.notifier).state = JsonCache(prefs);
}
