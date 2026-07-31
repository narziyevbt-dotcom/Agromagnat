/// Where the app talks to.
///
/// Supplied at build time so one codebase can point at the test deploy, a
/// laptop, or production without a code change:
///
///     flutter run --dart-define=API_URL=https://agromagnat-api.onrender.com/api
///
/// Empty means no backend, and the app runs entirely on its mock repositories.
/// That is not a debug affordance — it is how the screens were built, and it
/// keeps the app openable when there is nothing to talk to.
abstract final class ApiConfig {
  static const String baseUrl = String.fromEnvironment('API_URL');

  static bool get isConfigured => baseUrl.isNotEmpty;

  /// A phone in a field is regularly on EDGE. Long enough that a slow request
  /// finishes, short enough that a dead one does not hold the screen.
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  /// Uploads are the slow leg and get their own budget.
  static const Duration uploadTimeout = Duration(minutes: 2);
}
