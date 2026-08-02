/**
 * Relays Telegram updates to a local server, so the bot can be tried on a real
 * phone before anything is deployed.
 *
 *   npm run telegram:bridge
 *
 * A webhook needs a public HTTPS address, which a laptop does not have. Telegram
 * offers the other half of the same API — `getUpdates` — and this fetches from
 * there and posts each update at the local webhook, secret header and all. The
 * server cannot tell the difference, which is the point: what is exercised here
 * is the real handler, not a stand-in.
 *
 * Development only, and it says so loudly. `getUpdates` and a webhook are
 * mutually exclusive: Telegram refuses the first while the second is set, so
 * running this against production would mean deleting the production webhook —
 * which is why it refuses to start if one exists rather than clearing it.
 */
import { config } from 'dotenv';

config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const TARGET = process.env.BRIDGE_TARGET ?? 'http://localhost:3000/api/telegram/webhook';
const API = `https://api.telegram.org/bot${TOKEN}`;

/** Long-poll window. Telegram holds the connection open until something arrives. */
const LONG_POLL_SECONDS = 25;

interface Update {
  update_id: number;
  message?: {
    chat?: { id?: number };
    from?: { id?: number; first_name?: string };
    text?: string;
    contact?: { phone_number?: string };
  };
}

const stamp = () => new Date().toISOString().slice(11, 19);

async function forward(update: Update): Promise<void> {
  const message = update.message;
  const who = message?.from?.first_name ?? '?';
  const what = message?.contact
    ? `📱 kontakt (${message.contact.phone_number})`
    : (message?.text ?? '(matnsiz)');

  console.log(`${stamp()}  ← ${who}: ${what}`);

  const response = await fetch(TARGET, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
    body: JSON.stringify(update),
  });

  console.log(
    `${stamp()}  → ${TARGET.replace(/^https?:\/\//, '')} ${response.status}` +
      (response.ok ? '' : ` — ${(await response.text()).slice(0, 160)}`),
  );
}

async function main(): Promise<void> {
  if (!TOKEN || !SECRET) {
    console.error(
      '\n❌ TELEGRAM_BOT_TOKEN va TELEGRAM_WEBHOOK_SECRET kerak (.env faylida).\n',
    );
    process.exit(1);
  }

  const info = (await (await fetch(`${API}/getWebhookInfo`)).json()) as {
    result?: { url?: string };
  };
  if (info.result?.url) {
    console.error(
      `\n❌ Bu botda webhook o‘rnatilgan:\n   ${info.result.url}\n\n` +
        '   getUpdates va webhook birga ishlamaydi. Bu vosita faqat mahalliy\n' +
        '   ishlab chiqish uchun — production webhook’ini o‘chirmayman.\n',
    );
    process.exit(1);
  }

  const me = (await (await fetch(`${API}/getMe`)).json()) as {
    result?: { username?: string };
  };

  console.log(
    `\nTELEGRAM KO‘PRIGI (faqat ishlab chiqish uchun)\n` +
      `  Bot     @${me.result?.username}\n` +
      `  Manzil  ${TARGET}\n\n` +
      `  Telegramda botni oching va saytdagi havoladan /start bosing.\n` +
      `  To‘xtatish: Ctrl+C\n`,
  );

  let offset = 0;
  for (;;) {
    try {
      const response = await fetch(
        `${API}/getUpdates?timeout=${LONG_POLL_SECONDS}&offset=${offset}`,
      );
      const body = (await response.json()) as { ok?: boolean; result?: Update[] };

      for (const update of body.result ?? []) {
        // Acknowledged by advancing past it, whether or not the local server
        // liked it — a redelivery loop is exactly what this must not create.
        offset = update.update_id + 1;
        await forward(update).catch((error) =>
          console.error(`${stamp()}  ❌ ${String(error)}`),
        );
      }
    } catch (error) {
      console.error(`${stamp()}  ⚠ ${String(error)} — qayta urinilmoqda`);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
}

main().catch((error) => {
  console.error('\n❌', error);
  process.exit(1);
});
