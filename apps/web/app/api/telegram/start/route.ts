import { NextResponse } from 'next/server';
import { ApiError, startTelegramSignIn } from '@/lib/api';

/**
 * Begins a Telegram sign-in.
 *
 * A route handler rather than a server action because the browser needs the
 * deep link back in its own hands, immediately, to open a window — an action
 * that redirects or revalidates is the wrong shape for that.
 */
export async function POST() {
  try {
    return NextResponse.json(await startTelegramSignIn());
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    return NextResponse.json(
      {
        message:
          error instanceof ApiError
            ? error.message
            : "Telegram orqali kirishni boshlab bo'lmadi",
      },
      { status },
    );
  }
}
