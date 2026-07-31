/**
 * Proves the Eskiz credentials work, before anybody depends on them.
 *
 *   npm run sms:check                 # log in, show the account and balance
 *   npm run sms:check +998901234567   # …and send one real message to that number
 *
 * The order matters. Logging in tells you the email and password are right;
 * the balance tells you there is credit to spend; only the send tells you the
 * message body has been through moderation — Eskiz only delivers texts it has
 * approved in advance, and an unapproved one is refused with an HTTP 200 and a
 * refusal in the body. That is the failure everybody hits on launch day, and it
 * looks exactly like "SMS is just slow".
 *
 * Everything Eskiz answers is printed verbatim. This is a diagnostic: a
 * summarised error is a diagnostic that has thrown away the useful half.
 */
import { config } from 'dotenv';

config();

const BASE = process.env.ESKIZ_BASE_URL ?? 'https://notify.eskiz.uz/api';
const EMAIL = process.env.ESKIZ_EMAIL ?? '';
const PASSWORD = process.env.ESKIZ_PASSWORD ?? '';
const FROM = process.env.ESKIZ_FROM ?? '4546';

/** The exact text the application sends. Moderation approves this, not a paraphrase. */
const MESSAGE = (code: string) =>
  `Agromagnat tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`;

const line = (label: string, value: unknown) =>
  console.log(`  ${label.padEnd(22)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Left as text — an HTML error page is itself the answer.
  }
  return { status: response.status, body };
}

async function main(): Promise<void> {
  const target = process.argv[2];

  console.log('\nESKIZ TEKSHIRUVI');
  line('Manzil', BASE);
  line('Email', EMAIL || '(bo‘sh)');
  line('Jo‘natuvchi (from)', FROM);

  if (!EMAIL || !PASSWORD) {
    console.error(
      '\n❌ ESKIZ_EMAIL yoki ESKIZ_PASSWORD berilmagan. .env faylini to‘ldiring.',
    );
    process.exit(1);
  }

  // 1 — credentials
  console.log('\n1. Kirish (/auth/login)');
  const login = await call('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  line('HTTP', login.status);

  const token = (login.body as { data?: { token?: string } } | null)?.data?.token;
  if (!token) {
    console.error('\n❌ Token olinmadi. Eskiz javobi:');
    console.error(JSON.stringify(login.body, null, 2));
    process.exit(1);
  }
  line('Token', `${token.slice(0, 12)}… (${token.length} belgi)`);

  const auth = { Authorization: `Bearer ${token}` };

  // 2 — account and credit. Endpoint names have moved between Eskiz versions,
  // so each is tried and reported rather than assumed; a 404 here is harmless.
  console.log('\n2. Hisob va balans');
  for (const path of ['/auth/user', '/user/get-limit']) {
    const result = await call(path, { headers: auth });
    line(path, `HTTP ${result.status}`);
    if (result.status >= 200 && result.status < 300) {
      console.log('     ', JSON.stringify(result.body));
    }
  }

  if (!target) {
    console.log(
      '\n✅ Kalitlar ishlaydi.\n' +
        '   Haqiqiy SMS yuborib ko‘rish uchun raqam bering:\n' +
        '   npm run sms:check +998901234567\n' +
        '   Shundagina matn moderatsiyadan o‘tganini bilib olasiz.\n',
    );
    return;
  }

  // 3 — the only check that proves moderation
  const phone = target.replace(/\D/g, '');
  if (!/^998\d{9}$/.test(phone)) {
    console.error(`\n❌ Raqam noto‘g‘ri: ${target} (kutilgan: +998XXXXXXXXX)`);
    process.exit(1);
  }

  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  console.log(`\n3. SMS yuborish → +${phone}`);
  line('Matn', MESSAGE(code));

  const send = await call('/message/sms/send', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile_phone: phone, message: MESSAGE(code), from: FROM }),
  });
  line('HTTP', send.status);
  console.log('  Javob:', JSON.stringify(send.body, null, 2));

  const status = String((send.body as { status?: unknown } | null)?.status ?? '').toLowerCase();

  if (['rejected', 'failed', 'error', 'undelivered'].includes(status)) {
    console.error(
      `\n❌ Eskiz xabarni rad etdi (status: ${status}).\n` +
        '   Eng ehtimoliy sabab: yuqoridagi matn shablon sifatida tasdiqlanmagan.\n' +
        '   Eskiz kabinetida aynan shu matnni (kod o‘rniga %s bilan) shablonga qo‘shing\n' +
        '   va moderatsiyadan o‘tishini kuting.\n',
    );
    process.exit(1);
  }

  if (send.status < 200 || send.status >= 300) {
    console.error('\n❌ Yuborilmadi. Yuqoridagi javobga qarang.\n');
    process.exit(1);
  }

  console.log(
    `\n✅ Eskiz xabarni qabul qildi (status: ${status || 'noma’lum'}).\n` +
      `   ENDI TELEFONNI TEKSHIRING. Kod kelmasa — matn moderatsiyadan o‘tmagan,\n` +
      `   Eskiz esa buni "qabul qildim" deb ko‘rsatadi.\n` +
      `   Kutilayotgan kod: ${code}\n`,
  );
}

main().catch((error) => {
  console.error('\n❌ Kutilmagan xato:', error);
  process.exit(1);
});
