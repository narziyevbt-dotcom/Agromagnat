import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/cache/cache_providers.dart';
import 'core/localization/app_strings.dart';
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

class AgromagnatApp extends StatelessWidget {
  const AgromagnatApp({super.key});

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
