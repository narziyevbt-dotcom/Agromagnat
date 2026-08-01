# Kodni yetkazish — uch yo'l

> **Pul yo'q bo'lsa ham ishga tushish mumkin.** Pastdagi "Telegram boti orqali
> kirish" — **butunlay bepul**, cheksiz, va bugun sozlanadi. Undan boshlang.

| Yo'l | Narxi | Bugun tayyormi | Kimga yetadi |
|---|---|---|---|
| **Telegram boti** | **0** | ✅ 10 daqiqa | Telegram'i borlarga |
| Telegram Gateway | ~$0.01/kod | ✅ (balans kerak) | Telegram'i borlarga |
| Eskiz SMS | qimmat | ❌ shartnoma | hammaga |

---

## Telegram boti orqali kirish — BEPUL

Eng yaxshi yechim, va u hech narsa turmaydi.

Bot foydalanuvchidan raqamini so'raydi, u bitta tugmani bosadi, **Telegram
raqamni o'zi tasdiqlab yuboradi**. Kod umuman yuborilmaydi — demak yo'qoladigan,
kechikadigan yoki ushlab qolinadigan narsa yo'q. Bu SMS'dan **kuchliroq isbot**.

### Sozlash — 10 daqiqa, 0 so'm

1. Telegramda [@BotFather](https://t.me/BotFather) ga yozing → `/newbot`
2. Bot nomi va username'ini tanlang (masalan `agromagnat_bot`)
3. BotFather token beradi
4. `.env`:

```bash
TELEGRAM_BOT_TOKEN=<BotFather bergan token>
TELEGRAM_BOT_USERNAME=agromagnat_bot        # @ belgisisiz
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 24>
```

5. Webhook'ni ulang (sayt HTTPS'da turgandan keyin):

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://agromagnat.uz/api/telegram/webhook",
       "secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

Tayyor. `/kirish` sahifasida "Telegram orqali kirish" tugmasi paydo bo'ladi.

Web ilovasiga alohida o'zgaruvchi kerak emas: u `GET /auth/methods` orqali
backend'dan so'raydi. Sabab — `NEXT_PUBLIC_*` qiymatlari **build paytida**
kodga qotib qoladi, ya'ni konteynerda qo'yilgan qiymat hech narsani
o'zgartirmaydi va tugma jimgina paydo bo'lmaydi.

### ⚠️ Alohida bot oching

Mavjud botni ishlatmang. Telegram bitta botga **faqat bitta webhook** ruxsat
beradi — boshqa xizmatga ulangan botni olsangiz, o'sha xizmat ishlamay qoladi.
Va fermer "Agromagnat"ga kirayotganda boshqa nomdagi bot bilan gaplashsa,
ishonch yo'qoladi.

### Foydalanuvchi nima ko'radi

1. Saytda **"Telegram orqali kirish"** ni bosadi
2. Telegram ochiladi, bot: *"Agromagnat saytiga kirmoqchisiz"* + bitta tugma
3. **"📱 Raqamimni yuborish"** ni bosadi
4. Saytga qaytadi — allaqachon kirgan

SMS yo'q. Kod yo'q. Kutish yo'q. Xarajat yo'q.

### Xavfsizlik

- Kirish chiptasi **2 daqiqa** yashaydi va **bir marta** ishlatiladi
- Bot faqat **o'z** kontaktini qabul qiladi (`user_id` jo'natuvchiga teng
  bo'lishi shart) — do'stining kontaktini yuborib uning hisobiga kirib
  bo'lmaydi
- Webhook maxfiy kalit bilan himoyalangan
- Bot xabarida **nima tasdiqlanayotgani yozilgan**, shuning uchun buni
  boshlamagan odam to'xtay oladi

11 ta e2e test: `apps/backend/test/telegram-signin.e2e-spec.ts`

---

## Telegram Gateway — bugun ishga tushadigan yo'l

Telegram'ning rasmiy xizmati: kod to'g'ridan-to'g'ri **telefon raqamining
Telegram akkauntiga** boradi. Bot bilan adashtirmang — bot faqat uni ilgari
ishga tushirgan odamga yozadi, ya'ni birinchi kod uchun foydasiz. Gateway
raqamdan akkauntni o'zi topadi, shuning uchun **yangi kelgan odam uchun ham
ishlaydi**.

| | Telegram Gateway | Eskiz SMS |
|---|---|---|
| Shartnoma, STIR, imzo | ❌ kerak emas | ✅ kerak |
| Matn moderatsiyasi | ❌ kerak emas | ✅ kerak, kutish bilan |
| Bugun ishga tushadimi | ✅ ha | ❌ yo'q |
| Narxi (taxminan) | ~$0.01 | sezilarli qimmatroq |
| Yetkazilmasa | pul olinmaydi | pul ketishi mumkin |
| Kimga yetadi | Telegram'i borlarga | hammaga |

Oxirgi qator muhim: **Gateway Eskizni to'liq almashtirmaydi.** Telegram'i yo'q
raqam kod ololmaydi. Shuning uchun kod ikkalasini ham biladi va ketma-ket
sinaydi:

```
1. Telegram Gateway   — yangi odamga ham yetadi, ~$0.01
2. Telegram bot       — bepul, lekin botni ishga tushirganlarga
3. SMS (Eskiz)        — hammaga, eng qimmat
```

Biri yetkaza olmasa, keyingisi sinaladi.

### Sozlash

1. <https://gateway.telegram.org> — kiring va token oling
2. **Balansni to'ldiring.** Bu qadamni o'tkazib yubormang — pastga qarang
3. `.env`:

```bash
TELEGRAM_GATEWAY_TOKEN=<token>
TELEGRAM_GATEWAY_SENDER=          # ixtiyoriy, tasdiqlangan kanal nomi
TELEGRAM_GATEWAY_TTL=300
```

### Tekshirish

```bash
cd apps/backend

npm run gateway:check                        # token qabul qilinadimi (bepul)
npm run gateway:check +998901234567          # bu raqamga yetadimi (bepul)
npm run gateway:check +998901234567 --send   # haqiqiy kod yuboradi
```

Birinchi ikkitasi **pul sarflamaydi**. `--send` esa yuboradi — lekin **o'z
raqamingizga yuborish bepul**, shuning uchun birinchi haqiqiy sinovni o'zingizga
qiling.

### ⚠️ Balans tugasa

Bu eng chalg'ituvchi holat, va biz uni sinov paytida uchratdik.

Balansi bo'sh akkaunt **har bir raqamga** `BALANCE_NOT_ENOUGH` deb javob
beradi — hatto Telegram'i bor raqamga ham. Tashqaridan bu "bu odamda Telegram
yo'q" degandek ko'rinadi.

Kod endi ikkalasini ajratadi:

| Holat | Log darajasi | Ma'nosi |
|---|---|---|
| `BALANCE_NOT_ENOUGH` | **ERROR** | Kanal hamma uchun o'lik. Balansni to'ldiring |
| `ACCESS_TOKEN_INVALID` | **ERROR** | Token yoki jo'natuvchi noto'g'ri |
| `PHONE_NUMBER_NOT_FOUND` | debug | Oddiy holat — bu odam SMS oladi |

Agar buni ajratmasak, balans tugagani "odamlarda Telegram yo'q ekan" degan
xulosa ostida yashirinardi — va buni faqat SMS hisobi kelganda bilib olardik.

### Eskizsiz ishga tushirish

Agar Eskiz hali tayyor bo'lmasa:

```bash
SMS_PROVIDER=none
TELEGRAM_GATEWAY_TOKEN=<token>
```

`none` — bu buzilgan sozlama emas, ataylab qo'yilgan variant: SMS umuman
yuborilmaydi, kodlar faqat Telegram orqali ketadi. Telegram'i yo'q odam
hozircha ro'yxatdan o'ta olmaydi — bu **umuman ishga tushmaslikdan kichikroq
muammo**, va Eskiz ulangan kuni o'z-o'zidan hal bo'ladi.

Ilova `SMS_PROVIDER=none` bilan **Gateway tokenisiz ishga tushmaydi** — aks
holda sayt ochiladi-yu, hech kim kirolmaydi.

`SMS_PROVIDER=mock` esa production'da **har doim taqiqlangan**, Gateway bor
yoki yo'qligidan qat'i nazar: mock har bir kodni `000000` qilib qo'yadi.

---

# Eskiz.uz — SMS ulash

Bu — bugungi eng muhim ish. Bularsiz hech kim ro'yxatdan o'ta olmaydi, va
hozirgi `mock` rejimda kod har doim `000000` — ya'ni istalgan odam istalgan
hisobga kiradi.

Kod tomondan hammasi tayyor. Qolgani — akkaunt.

---

## 1. Akkaunt oching

<https://eskiz.uz> → ro'yxatdan o'tish.

Yuridik shaxs uchun odatda talab qilinadi:

- STIR (INN)
- Bank rekvizitlari
- Kompaniya nomi va manzili
- Mas'ul shaxs telefoni

Eskiz shartnoma yuboradi, siz imzolab qaytarasiz. **Bu bir kunda bo'lmasligi
mumkin** — reklama muddatini shunga qarab rejalashtiring.

## 2. Balans to'ldiring

SMS pul turadi. Balans tugasa **hech kim kira olmaydi** — bu login yo'lidagi
yagona nuqta. Kamida bir necha minglik zaxira qoldiring va kuzatib boring.

## 3. Jo'natuvchi nomi (sender / `from`)

Standart `4546` — Eskiz'ning umumiy test raqami. O'z nomingiz (masalan
`AGROMAGNAT`) alohida tasdiqlanadi va vaqt oladi.

Boshlash uchun `4546` yetarli. Keyin `ESKIZ_FROM` ni o'zgartirasiz, kodga
tegilmaydi.

## 4. ⚠️ SMS matnini shablon sifatida tasdiqlang

**Bu — eng ko'p o'tkazib yuboriladigan qadam, va u butun ishga tushishni
o'ldiradi.**

Eskiz faqat **oldindan tasdiqlangan** matnlarni yuboradi. Tasdiqlanmagan matn
uchun Eskiz **HTTP 200 qaytaradi** — ya'ni "qabul qildim" deydi — lekin SMS
hech qachon yetib bormaydi. Loglarda xato yo'q. Siz buni faqat "SMS kelmayapti"
degan qo'ng'iroqdan bilib olasiz.

Kabinetda shablonlar bo'limiga aynan shu matnni qo'shing:

```
Agromagnat tasdiqlash kodi: %s. Kodni hech kimga bermang.
```

`%s` — kod o'rniga. Matn **aynan shunday** bo'lishi kerak: bitta vergul yoki
nuqta farq qilsa ham, tasdiqlanmagan matn hisoblanadi.

> Ilova aynan shu matnni yuboradi — manba:
> `apps/backend/src/modules/auth/otp-channels/sms-otp.channel.ts`.
> Matnni o'zgartirsangiz, shablonni ham yangilang.

Moderatsiya bir necha soatdan bir kungacha vaqt oladi.

## 5. Kalitlarni qo'ying

```bash
SMS_PROVIDER=eskiz
ESKIZ_EMAIL=<kabinetdagi email>
ESKIZ_PASSWORD=<parol>
ESKIZ_BASE_URL=https://notify.eskiz.uz/api
ESKIZ_FROM=4546
```

## 6. Tekshiring — bitta buyruq

```bash
cd apps/backend

# Faqat kalitlarni tekshiradi: kirish, hisob, balans
npm run sms:check

# Haqiqiy SMS yuboradi — moderatsiyani faqat shu isbotlaydi
npm run sms:check +998901234567
```

Nima ko'rasiz:

| Natija | Ma'nosi |
|---|---|
| `❌ Token olinmadi` + `Неверный Email или пароль` | Email yoki parol xato |
| `✅ Kalitlar ishlaydi` | Kirish joyida, lekin matn hali tekshirilmagan |
| `❌ Eskiz xabarni rad etdi (status: rejected)` | **Matn shablon sifatida tasdiqlanmagan** — 4-qadamga qayting |
| `✅ Eskiz xabarni qabul qildi` **va telefonga SMS keldi** | Tayyor |
| `✅ qabul qildi` **lekin SMS kelmadi** | Baribir moderatsiya. Eskiz "qabul qildim" deydi, lekin yubormaydi |

**Oxirgi qatorga alohida e'tibor bering.** Yashil belgi yetarli emas —
telefonni qo'lingizga oling va SMS kelganini ko'ring. Bu ishga tushirishdagi
yagona haqiqiy tekshiruv.

## 7. Ishga tushiring

```bash
docker compose -f docker-compose.prod.yml up -d --build backend
```

Ilova `NODE_ENV=production` va `SMS_PROVIDER=mock` bilan **ataylab ishga
tushmaydi** — bu xatoni sezmay qolish mumkin emas.

---

## Kod nima qiladi

- **Kirish tokeni keshlanadi** va 401 kelganda bir marta qayta olinadi. Bir
  vaqtda faqat bitta kirish so'rovi ketadi — reklama boshlanganda kelgan
  navbat Eskiz'ning kirish cheklovini urib qo'ymasligi uchun
- **Javob tanasi o'qiladi**, faqat HTTP kodi emas. `rejected` → xatolik logga
  yoziladi va xabar muvaffaqiyatsiz hisoblanadi
- **Notanish javob** — logga to'liq yoziladi, lekin kirish yo'li to'xtatilmaydi
- **SMS yuborilmasa** OTP dispetcheri Telegram kanaliga o'tadi (agar bot
  sozlangan bo'lsa) — `docs/AUTH.md`

Testlar: `apps/backend/src/modules/auth/sms/eskiz-sms.service.spec.ts`

## Telegram — SMS'ga arzon muqobil

`TELEGRAM_BOT_TOKEN` qo'yilsa, botni ishga tushirgan foydalanuvchilarga kodlar
**bepul** Telegram orqali boradi, SMS esa zaxira bo'lib qoladi. Fermerlarning
katta qismi Telegram'da — bu SMS xarajatini sezilarli kamaytiradi.
Sozlash: `docs/AUTH.md`.
