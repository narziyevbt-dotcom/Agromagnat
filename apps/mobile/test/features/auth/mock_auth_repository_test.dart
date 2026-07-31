import 'package:agromagnat/features/auth/data/mock_auth_repository.dart';
import 'package:agromagnat/features/auth/domain/repositories/auth_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// The mock copies the backend's OTP rules rather than approximating them —
/// the login screen's countdown, attempt handling and disabled states are all
/// written against these numbers.
void main() {
  late DateTime now;
  late MockAuthRepository repository;

  setUp(() {
    now = DateTime.utc(2026, 7, 31, 12);
    repository = MockAuthRepository(
      latency: Duration.zero,
      clock: () => now,
    );
  });

  group('phone normalisation', () {
    test('accepts the forms people actually type', () {
      // The field collects nine national digits; pasted numbers arrive with a
      // country code, spaces or dashes.
      expect(MockAuthRepository.normalisePhone('901234567'), '+998901234567');
      expect(MockAuthRepository.normalisePhone('90 123 45 67'), '+998901234567');
      expect(MockAuthRepository.normalisePhone('+998 90 123-45-67'), '+998901234567');
      expect(MockAuthRepository.normalisePhone('998901234567'), '+998901234567');
    });

    test('rejects anything that is not an Uzbek mobile number', () async {
      await expectLater(
        repository.requestOtp('12345'),
        throwsA(
          isA<AuthException>().having(
            (e) => e.kind,
            'kind',
            AuthFailureKind.invalidPhone,
          ),
        ),
      );
    });
  });

  group('requestOtp', () {
    test('returns the server-side TTL, which drives the resend timer',
        () async {
      final challenge = await repository.requestOtp('901234567');

      expect(challenge.phone, '+998901234567');
      expect(challenge.expiresIn, 300);
    });

    test('throttles after three requests inside the window', () async {
      for (var i = 0; i < 3; i++) {
        await repository.requestOtp('901234567');
      }

      await expectLater(
        repository.requestOtp('901234567'),
        throwsA(
          isA<AuthException>()
              .having((e) => e.kind, 'kind', AuthFailureKind.rateLimited)
              .having((e) => e.retryAfter, 'retryAfter', isNotNull),
        ),
      );
    });

    test('the throttle lifts once the window passes', () async {
      for (var i = 0; i < 3; i++) {
        await repository.requestOtp('901234567');
      }
      now = now.add(const Duration(minutes: 11));

      final challenge = await repository.requestOtp('901234567');
      expect(challenge.expiresIn, 300);
    });

    test('throttles per phone, not globally', () async {
      for (var i = 0; i < 3; i++) {
        await repository.requestOtp('901234567');
      }

      // A second farmer on the same handset must not be locked out.
      final other = await repository.requestOtp('935558811');
      expect(other.phone, '+998935558811');
    });
  });

  group('verifyOtp', () {
    test('signs in and reports a first login', () async {
      await repository.requestOtp('901234567');
      final session = await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
      );

      expect(session.accessToken, isNotEmpty);
      expect(session.refreshToken, isNotEmpty);
      expect(session.isNewUser, isTrue);
    });

    test('a returning user is not reported as new', () async {
      await repository.requestOtp('901234567');
      await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
      );

      await repository.requestOtp('901234567');
      final second = await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
      );

      expect(second.isNewUser, isFalse);
    });

    test('rejects a wrong code without burning it', () async {
      await repository.requestOtp('901234567');

      await expectLater(
        repository.verifyOtp(phone: '+998901234567', code: '111111'),
        throwsA(
          isA<AuthException>().having((e) => e.kind, 'kind', AuthFailureKind.wrongCode),
        ),
      );

      // One fat-fingered digit must not cost a whole SMS.
      final session = await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
      );
      expect(session.accessToken, isNotEmpty);
    });

    test('burns the code after five wrong guesses', () async {
      await repository.requestOtp('901234567');

      for (var i = 0; i < 5; i++) {
        await expectLater(
          repository.verifyOtp(phone: '+998901234567', code: '111111'),
          throwsA(isA<AuthException>()),
        );
      }

      await expectLater(
        repository.verifyOtp(
          phone: '+998901234567',
          code: MockAuthRepository.devCode,
        ),
        throwsA(
          isA<AuthException>()
              .having((e) => e.kind, 'kind', AuthFailureKind.tooManyAttempts),
        ),
      );
    });

    test('expires the code after five minutes', () async {
      await repository.requestOtp('901234567');
      now = now.add(const Duration(minutes: 6));

      await expectLater(
        repository.verifyOtp(
          phone: '+998901234567',
          code: MockAuthRepository.devCode,
        ),
        throwsA(
          isA<AuthException>()
              .having((e) => e.kind, 'kind', AuthFailureKind.expiredCode),
        ),
      );
    });

    test('a successful login clears the throttle', () async {
      for (var i = 0; i < 3; i++) {
        await repository.requestOtp('901234567');
      }
      await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
      );

      // Signing in and straight back out must not leave the phone locked.
      final again = await repository.requestOtp('901234567');
      expect(again.expiresIn, 300);
    });

    test('refuses a code that was never requested', () async {
      await expectLater(
        repository.verifyOtp(
          phone: '+998901234567',
          code: MockAuthRepository.devCode,
        ),
        throwsA(
          isA<AuthException>()
              .having((e) => e.kind, 'kind', AuthFailureKind.expiredCode),
        ),
      );
    });
  });

  group('me and profile', () {
    Future<String> signIn() async {
      await repository.requestOtp('901234567');
      final session = await repository.verifyOtp(
        phone: '+998901234567',
        code: MockAuthRepository.devCode,
        name: 'Anvar aka',
      );
      return session.accessToken;
    }

    test('returns the signed-in user', () async {
      final token = await signIn();
      final user = await repository.me(token);

      expect(user.phone, '+998901234567');
      expect(user.name, 'Anvar aka');
    });

    test('rejects an unknown token', () async {
      await expectLater(repository.me('nonsense'), throwsA(isA<AuthException>()));
    });

    test('updates the name and keeps the rest', () async {
      final token = await signIn();
      final updated = await repository.updateProfile(
        accessToken: token,
        name: 'Anvar Yusupov',
      );

      expect(updated.name, 'Anvar Yusupov');
      expect(updated.phone, '+998901234567');
      // A PATCH that omits a field must not clear it.
      expect(updated.region, isNotNull);
    });
  });
}
