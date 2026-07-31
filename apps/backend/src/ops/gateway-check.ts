/**
 * Proves the Telegram Gateway token works, before anybody depends on it.
 *
 *   npm run gateway:check                 # is the token accepted?
 *   npm run gateway:check +998901234567   # can this number be reached?
 *   npm run gateway:check +998901234567 --send   # actually send a code
 *
 * The first two cost nothing. `checkSendAbility` is free whether or not the
 * number turns out to be reachable, so it is the honest way to answer "will
 * this work for my users" without spending anything.
 *
 * Only `--send` delivers a message. Sending to *your own* number is free, which
 * is what makes it the right first real test: you see the message arrive on
 * your own phone before a single customer does.
 *
 * Everything Telegram answers is printed verbatim. A summarised error is a
 * diagnostic that has thrown away the useful half.
 */
import { config } from 'dotenv';
import { classify, explain } from '../modules/auth/otp-channels/gateway-errors';

config();

const BASE = 'https://gatewayapi.telegram.org';
const TOKEN = process.env.TELEGRAM_GATEWAY_TOKEN ?? '';
const SENDER = process.env.TELEGRAM_GATEWAY_SENDER ?? '';
const TTL = parseInt(process.env.TELEGRAM_GATEWAY_TTL ?? '300', 10);

const line = (label: string, value: unknown) =>
  console.log(
    `  ${label.padEnd(22)} ${typeof value === 'string' ? value : JSON.stringify(value)}`,
  );

interface Reply {
  ok?: boolean;
  error?: string;
  result?: {
    request_id?: string;
    request_cost?: number;
    remaining_balance?: number;
    delivery_status?: { status?: string };
  };
}

async function call(path: string, body: Record<string, unknown>): Promise<Reply> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await response.json()) as Reply;
}

async function main(): Promise<void> {
  const target = process.argv[2];
  const reallySend = process.argv.includes('--send');

  console.log('\nTELEGRAM GATEWAY TEKSHIRUVI');
  line('Token', TOKEN ? `${TOKEN.slice(0, 8)}… (${TOKEN.length} belgi)` : '(bo‘sh)');
  line('Jo‘natuvchi', SENDER || '(standart)');

  if (!TOKEN) {
    console.error(
      '\n❌ TELEGRAM_GATEWAY_TOKEN berilmagan.\n' +
        '   Token: https://gateway.telegram.org\n',
    );
    process.exit(1);
  }

  // 1 — the token, at no cost. A malformed request is enough: an accepted
  // token complains about the phone number, a bad one about itself.
  console.log('\n1. Token tekshiruvi');
  const probe = await call('/checkSendAbility', {});
  if (probe.error === 'ACCESS_TOKEN_INVALID') {
    console.error('\n❌ Token yaroqsiz. Kabinetdan qaytadan oling.\n');
    process.exit(1);
  }
  console.log('  ✅ Token qabul qilindi');

  if (!target) {
    console.log(
      '\n   Raqamni tekshirish uchun:\n' +
        '   npm run gateway:check +998901234567\n' +
        '   Bu bepul — faqat "shu raqamda Telegram bormi?" deb so‘raydi.\n',
    );
    return;
  }

  const phone = target.startsWith('+') ? target : `+${target.replace(/\D/g, '')}`;
  if (!/^\+998\d{9}$/.test(phone)) {
    console.error(`\n❌ Raqam noto‘g‘ri: ${target} (kutilgan: +998XXXXXXXXX)\n`);
    process.exit(1);
  }

  // 2 — free, and the answer that actually matters for coverage
  console.log(`\n2. ${phone} — Telegram orqali yetib boradimi?`);
  const ability = await call('/checkSendAbility', { phone_number: phone });
  console.log('  Javob:', JSON.stringify(ability));

  if (!ability.ok) {
    // "No Telegram on this number" and "our account is empty" arrive as the
    // same shape and need opposite responses. Printing one message for both is
    // how you spend a launch day looking for a problem you do not have.
    const fault = classify(ability.error);
    console.log(`\n⚠️  ${explain(fault, ability.error)}`);

    if (fault === 'account') {
      console.log(
        '\n   ❗ Bu raqamning aybi emas — HISOBDA PUL YO‘Q.\n' +
          '   gateway.telegram.org da balansni to‘ldiring, keyin qayta sinang.\n' +
          '   (O‘z raqamingizga yuborish baribir bepul.)\n',
      );
    } else if (fault === 'config') {
      console.log('\n   ❗ Token yoki jo‘natuvchi sozlamasi noto‘g‘ri.\n');
    } else {
      console.log(
        '\n   Bu xato emas — bu raqamda Telegram yo‘q yoki yopiq.\n' +
          '   Ilova bunday holatda SMS ga o‘tadi (SMS_PROVIDER=eskiz bo‘lsa).\n',
      );
    }
    return;
  }

  console.log('  ✅ Yetib boradi');
  if (ability.result?.request_cost !== undefined) {
    line('Narxi', ability.result.request_cost);
  }
  if (ability.result?.remaining_balance !== undefined) {
    line('Qolgan balans', ability.result.remaining_balance);
  }

  if (!reallySend) {
    console.log(
      '\n   Haqiqiy kod yuborish uchun --send qo‘shing:\n' +
        `   npm run gateway:check ${phone} --send\n` +
        '   O‘z raqamingizga yuborish bepul.\n',
    );
    return;
  }

  // 3 — a real message
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  console.log(`\n3. Kod yuborilmoqda → ${phone}`);
  line('Kod', code);

  const sent = await call('/sendVerificationMessage', {
    phone_number: phone,
    request_id: ability.result?.request_id,
    code,
    ttl: TTL,
    ...(SENDER ? { sender_username: SENDER } : {}),
  });
  console.log('  Javob:', JSON.stringify(sent, null, 2));

  if (!sent.ok) {
    console.error(`\n❌ Yuborilmadi: ${sent.error}\n`);
    process.exit(1);
  }

  console.log(
    `\n✅ Telegram xabarni qabul qildi.\n` +
      `   ENDI TELEGRAM'INGIZNI OCHING — kod ${code} kelgan bo‘lishi kerak.\n`,
  );
}

main().catch((error) => {
  console.error('\n❌ Kutilmagan xato:', error);
  process.exit(1);
});
