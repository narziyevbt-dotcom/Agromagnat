import type { Metadata } from 'next';
import { t } from '@/lib/strings';

export const metadata: Metadata = {
  title: t.footer.about,
  description:
    "Agromagnat — fermer hosilini vositachisiz to'g'ridan-to'g'ri xaridorga sotadigan bozor.",
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">{t.footer.about}</h1>

      <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink-muted">
        <p>
          Agromagnat — fermer hosilini vositachisiz to&apos;g&apos;ridan-to&apos;g&apos;ri
          xaridorga sotadigan, butun O&apos;zbekiston bo&apos;ylab ishlaydigan bozor.
        </p>
        <p>
          Muammo oddiy: dallol narxni ikki-uch barobar tushiradi, fermer esa hosilini
          qayerga sotishni bilmaydi. Biz bu ikkisini bevosita bog&apos;laymiz — xaridor
          e&apos;lonni ko&apos;radi va fermerning o&apos;ziga qo&apos;ng&apos;iroq qiladi.
          Oradan hech kim o&apos;tmaydi va hech kim komissiya olmaydi.
        </p>
        <p>
          Oddiy e&apos;lonlar taxtasidan farqi shundaki, bu yerda har bir e&apos;londa hajm
          va o&apos;lchov birligi majburiy, narxlar kunlik indeks sifatida yuritiladi va
          mahsulot mavsumi ko&apos;rsatiladi. Ulgurji xaridor uchun aynan shu uchtasi muhim.
        </p>
        <p>
          E&apos;lon joylash bepul va shunday qoladi.
        </p>
      </div>
    </article>
  );
}
