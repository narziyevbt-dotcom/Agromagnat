import 'package:flutter/foundation.dart';

import '../../../listings/domain/entities/location.dart';

enum UserRole {
  user('user'),
  moderator('moderator'),
  admin('admin');

  const UserRole(this.wire);

  final String wire;

  static UserRole fromWire(String? value) {
    return UserRole.values.firstWhere(
      (role) => role.wire == value,
      orElse: () => UserRole.user,
    );
  }
}

/// The signed-in user, as `GET /auth/me` returns them.
///
/// [phone] is the identity — there are no passwords and no email. A farmer
/// signs in with the number buyers already call.
@immutable
class AuthUser {
  const AuthUser({
    required this.id,
    required this.phone,
    this.name,
    this.role = UserRole.user,
    this.isVerified = false,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.salesCount = 0,
    this.region,
    this.district,
  });

  final String id;
  final String phone;
  final String? name;
  final UserRole role;
  final bool isVerified;
  final double ratingAvg;
  final int ratingCount;
  final int salesCount;

  /// Default location, pre-filled into the posting form.
  final Region? region;
  final District? district;

  String get displayName => name?.trim().isNotEmpty == true ? name!.trim() : 'Fermer';

  /// A first-time user has no name yet, and the profile screen asks for one
  /// before the posting form can pre-fill anything useful.
  bool get needsProfile => name == null || name!.trim().isEmpty;

  AuthUser copyWith({
    String? name,
    Region? region,
    District? district,
  }) {
    return AuthUser(
      id: id,
      phone: phone,
      name: name ?? this.name,
      role: role,
      isVerified: isVerified,
      ratingAvg: ratingAvg,
      ratingCount: ratingCount,
      salesCount: salesCount,
      region: region ?? this.region,
      district: district ?? this.district,
    );
  }

  @override
  bool operator ==(Object other) => other is AuthUser && other.id == id;

  @override
  int get hashCode => id.hashCode;
}

/// What `POST /auth/verify-otp` hands back.
@immutable
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    this.isNewUser = false,
  });

  final String accessToken;
  final String refreshToken;

  /// True when this login created the account, which is what decides whether
  /// the app asks for a name next.
  final bool isNewUser;
}
