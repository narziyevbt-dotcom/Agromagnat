import 'package:agromagnat/core/cache/json_cache.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late JsonCache cache;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    cache = JsonCache(await SharedPreferences.getInstance());
  });

  test('reads back what was written, with when', () async {
    final at = DateTime(2026, 7, 31, 12);
    await cache.write('feed', [
      {'id': 'a'},
    ], now: at);

    final entry = cache.read<List<dynamic>>('feed', (json) => json as List);

    expect(entry, isNotNull);
    expect(entry!.value.length, 1);
    expect(entry.cachedAt, at);
  });

  test('a miss is null, not an exception', () {
    expect(cache.read<Object>('nothing', (json) => json!), isNull);
  });

  test('reports its own age', () async {
    final at = DateTime(2026, 7, 31, 12);
    await cache.write('feed', [], now: at);

    final entry = cache.read<List<dynamic>>('feed', (json) => json as List)!;
    final now = at.add(const Duration(hours: 3));

    expect(entry.age(now: now), const Duration(hours: 3));
    expect(entry.isOlderThan(const Duration(hours: 1), now: now), isTrue);
    expect(entry.isOlderThan(const Duration(days: 1), now: now), isFalse);
  });

  test('an entry a newer build cannot decode is dropped, not thrown', () async {
    await cache.write('feed', {'shape': 'from an older release'});

    final entry = cache.read<int>('feed', (json) => (json as Map)['missing'] as int);

    // The cache is disposable. An app that cannot start because a release
    // renamed a field is a far worse outcome than a cold cache.
    expect(entry, isNull);
    expect(cache.read<Object>('feed', (json) => json!), isNull);
  });

  test('clear removes everything it owns', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('somebody_elses_key', 'keep me');

    await cache.write('feed', []);
    await cache.write('categories', []);
    await cache.clear();

    expect(cache.read<Object>('feed', (json) => json!), isNull);
    expect(cache.read<Object>('categories', (json) => json!), isNull);
    // A cached listing carries isFavorite, which belongs to whoever was
    // signed in — but the cache only clears its own keys.
    expect(prefs.getString('somebody_elses_key'), 'keep me');
  });
}
