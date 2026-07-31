import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Something read from the cache, and when it was put there.
@immutable
class CachedValue<T> {
  const CachedValue({required this.value, required this.cachedAt});

  final T value;
  final DateTime cachedAt;

  Duration age({DateTime? now}) => (now ?? DateTime.now()).difference(cachedAt);

  bool isOlderThan(Duration limit, {DateTime? now}) => age(now: now) > limit;
}

/// A small JSON store on disk.
///
/// SharedPreferences rather than a database: what is kept here is one page of
/// listings and the catalogue, both of which are read whole and replaced
/// whole. A database would buy queries nothing asks for, and its migration
/// story is a real cost — a schema change on a farmer's phone that fails
/// leaves the app unable to open.
///
/// Nothing here is authoritative. It exists so a screen has something to show
/// while the network is answering, or when it never does.
class JsonCache {
  JsonCache(this._prefs);

  final SharedPreferences _prefs;

  static const String _prefix = 'agm_cache_';
  static const String _stampSuffix = '_at';

  /// Reads and decodes, or null if absent or unreadable.
  ///
  /// A decode failure is treated as a miss and the entry is dropped. The
  /// alternative is an app that cannot start because a release changed a
  /// field name — the cache is disposable and should behave like it.
  CachedValue<T>? read<T>(String key, T Function(dynamic json) decode) {
    final raw = _prefs.getString('$_prefix$key');
    final stamp = _prefs.getInt('$_prefix$key$_stampSuffix');
    if (raw == null || stamp == null) {
      return null;
    }

    try {
      return CachedValue<T>(
        value: decode(jsonDecode(raw)),
        cachedAt: DateTime.fromMillisecondsSinceEpoch(stamp),
      );
    } on Object {
      remove(key);
      return null;
    }
  }

  Future<void> write(String key, Object? json, {DateTime? now}) async {
    await _prefs.setString('$_prefix$key', jsonEncode(json));
    await _prefs.setInt(
      '$_prefix$key$_stampSuffix',
      (now ?? DateTime.now()).millisecondsSinceEpoch,
    );
  }

  Future<void> remove(String key) async {
    await _prefs.remove('$_prefix$key');
    await _prefs.remove('$_prefix$key$_stampSuffix');
  }

  /// Everything, on sign-out. A cached feed is public, but a cached listing
  /// carries `isFavorite`, which belongs to whoever was signed in.
  Future<void> clear() async {
    for (final key in _prefs.getKeys().where((k) => k.startsWith(_prefix))) {
      await _prefs.remove(key);
    }
  }
}
