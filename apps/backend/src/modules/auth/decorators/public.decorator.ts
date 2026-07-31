import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of JwtAuthGuard.
 *
 * The guard is registered globally, so authentication is the default and each
 * exception has to be written down — the safe direction for a marketplace where
 * an unguarded write endpoint means anyone can post as anyone.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
