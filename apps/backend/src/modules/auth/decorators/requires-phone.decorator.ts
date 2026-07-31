import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PHONE_KEY = 'requiresPhone';

/**
 * Marks a route that may only be used once the caller has a verified phone.
 *
 * Applied to every action that reaches another person: posting a listing,
 * opening a chat, making an offer, saving a favourite, editing a profile.
 * Browsing is deliberately not on that list — a buyer evaluating the market
 * costs us nothing, and an SMS costs money, so charging ourselves to turn
 * visitors away was the wrong trade.
 *
 * The phone is not a login credential any more. It is accountability: the thing
 * that makes a seller reachable and a scammer traceable.
 */
export const RequiresPhone = () => SetMetadata(REQUIRES_PHONE_KEY, true);
