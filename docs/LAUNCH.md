# Ishga tushirish ro'yxati

Reklama boshlanishidan **oldin** bajarilishi shart bo'lgan ishlar. Kod bilan hal
qilinadiganlari bajarildi; qolganlari akkaunt, kalit yoki server talab qiladi va
ularni faqat asoschi qila oladi.

## 🔴 To'sqinlik qiladi — bularsiz reklama qilib bo'lmaydi

### 1. Kodni haqiqiy kanal orqali yuborish

Hozir `SMS_PROVIDER=mock`. **Kod har doim `000000`.** Ya'ni saytni topgan har
kim istalgan telefon raqamni kiritib, o'sha odam sifatida kiradi — shu jumladan
admin sifatida.

**Uch yo'l bor, va eng tezi bepul:**

**a) Telegram boti — 0 so'm, 10 daqiqa.** [@BotFather](https://t.me/BotFather)
dan token olasiz, bot foydalanuvchidan raqamini so'raydi, Telegram uni o'zi
tasdiqlaydi. Kod umuman yuborilmaydi. **Pul kerak emas.**

```
SMS_PROVIDER=none
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_BOT_USERNAME=agromagnat_bot
TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 24>
NEXT_PUBLIC_TELEGRAM_BOT=1
```

**b) Telegram Gateway — ~$0.01/kod.** Balans kerak. Botni to'ldiruvchi variant.

**c) Eskiz SMS — hammaga yetadi, lekin shartnoma va moderatsiya vaqt oladi.**

Batafsil: [docs/ESKIZ.md](ESKIZ.md). Boshlash uchun **(a) yetarli**.

Kerak: Eskiz.uz akkaunti. **To'liq qadamlar: [docs/ESKIZ.md](ESKIZ.md)** —
u yerda eng ko'p o'tkazib yuboriladigan qadam ham bor (SMS matnini shablon
sifatida tasdiqlash; tasdiqlanmasa Eskiz "yubordim" deydi, lekin yubormaydi).

So'ng bu o'zgaruvchilar:

```
SMS_PROVIDER=eskiz
ESKIZ_EMAIL=...
ESKIZ_PASSWORD=...
ESKIZ_FROM=4546
```

Tekshirish: `cd apps/backend && npm run sms:check +998901234567`

Ilova `NODE_ENV=production` bilan `SMS_PROVIDER=mock` da **umuman ishga
tushmaydi** — bu ataylab shunday qilingan (`env.validation.ts`). Ya'ni bu
xatoni sezmay qolish mumkin emas, lekin uni oldindan hal qilish kerak.

### 2. JWT kalitlari

```
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
```

Repozitoriy ochiq. Standart qiymatlar hammaga ko'rinadi va `role` token ichida
yuradi — kalitni bilgan odam o'ziga admin tokeni yasay oladi. Ilova standart
qiymat bilan production'da ishga tushmaydi.

### 3. Server O'zbekiston ichida

Qonuniy talab. Vercel va Render — faqat ko'rib chiqish uchun, production emas.
Ubuntu 24 serverga o'rnatish yo'riqnomasi: `docs/DEPLOY.md`.

### 4. `agromagnat.uz` domeni

Hozir mock-OTP'li deploy'ga ulangan. Yuqoridagi 1–3 bajarilmaguncha domenni
jonli qilmaslik kerak.

## 🟡 Reklamadan oldin bo'lgani yaxshi

| Ish | Nima uchun |
|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_ID` | Google tugmasi shusiz umuman ko'rinmaydi. Android telefondagi odam uchun bir bosishlik kirish — va bizga SMS'ga pul ketmaydi |
| `public/hero.jpg` | Landing hozir chizilgan SVG bilan ishlaydi. Haqiqiy fotosurat birinchi taassurot |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` | Kodlar SMS o'rniga Telegram orqali bepul boradi |
| Boshlang'ich e'lonlar | Bo'sh bozor — ketadigan bozor. Reklamadan oldin bir necha o'nlab haqiqiy e'lon kerak |
| Zaxira nusxa jadvali | `docs/DEPLOY.md` da bor, lekin yoqilganini tekshiring |

## ✅ Kod tomondan tayyor

- **Ro'yxatdan o'tish**: telefon → kod (avtomatik yuboriladi) → ism → ichkariga.
  Haqiqiy brauzerda boshdan-oxir tekshirilgan
- **Google bilan kirish**: backend tayyor, tugma client id qo'yilishi bilan chiqadi
- **Telefon darvozasi**: telefonsiz akkaunt ko'radi, lekin e'lon joylay olmaydi,
  yozisha olmaydi, sevimliga qo'sha olmaydi
- **Sessiya**: 30 kun, avtomatik yangilanadi, "barcha qurilmalardan chiqish" bor
- **Yozishga cheklov**: soatiga 20 e'lon, 30 suhbat, 40 taklif, 120 sevimli —
  bitta hisob uchun
- **Testlar**: 155 backend unit, 178 backend e2e, 74 web

## Ishga tushgandan keyin birinchi kun

1. `/health` — postgres va redis "up"
2. Haqiqiy telefonda ro'yxatdan o'ting. **SMS keldimi?** Bu birinchi tekshiruv
3. E'lon joylang, rasm yuklang, o'zingizga xabar yozing
4. `docker compose logs backend | grep -i error`
5. Eskiz balansini kuzating — SMS pul turadi va tugab qolsa hech kim kira olmaydi
