import 'reflect-metadata';
import { User, UserRole } from '../../modules/users/entities/user.entity';
import dataSource from '../data-source';

/**
 * Promotes an existing account to admin:
 *
 *   npm run seed:admin -- +998901234567
 *
 * Deliberately promotion-only: the account must already exist, meaning its
 * owner has proven control of the phone number through the normal OTP login.
 * A script that conjured an admin with a password would bypass the only
 * authentication factor the system has.
 */
async function main(): Promise<void> {
  const phone = process.argv[2]?.trim();
  if (!phone || !/^\+998\d{9}$/.test(phone)) {
    console.error('Usage: npm run seed:admin -- +998XXXXXXXXX');
    process.exit(1);
  }

  const ds = await dataSource.initialize();
  try {
    const users = ds.getRepository(User);
    const user = await users.findOne({ where: { phone } });

    if (!user) {
      console.error(
        `No account for ${phone}. Log in through the app once (OTP), then re-run.`,
      );
      process.exit(1);
    }

    await users.update(user.id, { role: UserRole.ADMIN });
    console.log(`${phone} (${user.name ?? 'nomsiz'}) is now an admin.`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error) => {
  console.error('make-admin failed:', error);
  process.exit(1);
});
