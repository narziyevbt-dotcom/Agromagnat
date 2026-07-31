import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/cache/cache_providers.dart';
import 'core/localization/app_strings.dart';
import 'features/listings/presentation/providers/outbox_providers.dart';
import 'core/theme/app_theme.dart';
import 'features/shell/presentation/main_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final container = ProviderContainer();
  // Awaited, not fired off: the home screen paints from this on its first
  // build, and a cache that opens a frame later shows an empty feed and then
  // jumps.
  await initCache(container);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const AgromagnatApp(),
    ),
  );
}

/// Sends whatever is in the outbox whenever the app comes back to the front.
///
/// Not a background service: this audience walks out of signal and back into
/// it, and the moment the phone is in their hand again is exactly when the
/// listing should go. A real background worker would need WorkManager on one
/// platform and BGTaskScheduler on the other, for a queue that is usually one
/// item deep.
class AgromagnatApp extends ConsumerStatefulWidget {
  const AgromagnatApp({super.key});

  @override
  ConsumerState<AgromagnatApp> createState() => _AgromagnatAppState();
}

class _AgromagnatAppState extends ConsumerState<AgromagnatApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // On launch too — the app may have been killed while something waited.
    WidgetsBinding.instance.addPostFrameCallback((_) => _flush());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _flush();
    }
  }

  void _flush() {
    ref.read(outboxControllerProvider.notifier).flush();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppStrings.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      locale: const Locale('uz'),
      supportedLocales: const [Locale('uz'), Locale('ru')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const MainShell(),
    );
  }
}
