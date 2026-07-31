import type { Metadata } from 'next';
import { t } from '@/lib/strings';

export const metadata: Metadata = {
  title: t.footer.terms,
  description: 'Agromagnat platformasidan foydalanish shartlari.',
};

/**
 * Plain-language summary of how the platform works.
 *
 * This is not a substitute for a lawyer-reviewed agreement — see docs/WEB.md.
 * It is written so that what it says is true of the product as built, rather
 * than boilerplate that promises things the code does not do.
 */
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">{t.footer.terms}</h1>

      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink-muted">
        <section>
          <h2 className="text-lg text-ink">Platforma nima qiladi</h2>
          <p className="mt-2">
            Agromagnat — e&apos;lonlar taxtasi. Biz sotuvchi va xaridorni bog&apos;laymiz,
            lekin oldi-sotdining o&apos;zida ishtirok etmaymiz: pul platformadan
            o&apos;tmaydi, tovar biz orqali yetkazilmaydi.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Sotuvchi javobgarligi</h2>
          <p className="mt-2">
            E&apos;londagi ma&apos;lumot — hajm, narx, sifat, joylashuv — to&apos;g&apos;ri
            bo&apos;lishi uchun javobgarlik sotuvchida. Faqat o&apos;zingizda mavjud va
            sotishga haqli bo&apos;lgan mahsulotni joylang.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Taqiqlanadi</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Qishloq xo&apos;jaligiga aloqasi yo&apos;q mahsulot</li>
            <li>Qonun bilan taqiqlangan tovarlar</li>
            <li>Yolg&apos;on narx yoki hajm, takroriy va spam e&apos;lonlar</li>
            <li>Boshqa shaxs nomidan uning roziligisiz e&apos;lon joylash</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg text-ink">Moderatsiya</h2>
          <p className="mt-2">
            E&apos;lonlar tekshiruvdan o&apos;tadi. Shartlarga zid e&apos;lon bloklanishi,
            takroriy buzilishda hisob to&apos;xtatilishi mumkin. Shikoyat tugmasi har bir
            e&apos;lon sahifasida.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">E&apos;lon muddati</h2>
          <p className="mt-2">
            Har bir e&apos;lon joylangandan 14 kun o&apos;tib avtomatik arxivlanadi. Uni
            qayta faollashtirish mumkin.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Kelishmovchilik</h2>
          <p className="mt-2">
            Sotuvchi va xaridor o&apos;rtasidagi nizolarga platforma tomon emas. Biz
            faqat moderatsiya va shikoyatlar bo&apos;yicha choralar ko&apos;ramiz.
          </p>
        </section>
      </div>
    </article>
  );
}
