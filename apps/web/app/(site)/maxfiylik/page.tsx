import type { Metadata } from 'next';
import { t } from '@/lib/strings';

export const metadata: Metadata = {
  title: t.footer.privacy,
  description: "Agromagnat qanday ma'lumot yig'adi va undan qanday foydalanadi.",
};

/**
 * Describes what the system actually stores, field by field, matching the
 * database schema. It is deliberately specific rather than boilerplate: the
 * Play Store data-safety form has to agree with it, and a generic policy that
 * overstates collection is both a compliance risk and a trust one.
 *
 * Needs a lawyer's review before launch — see docs/WEB.md.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl">{t.footer.privacy}</h1>

      <div className="mt-6 space-y-6 text-[15px] leading-relaxed text-ink-muted">
        <section>
          <h2 className="text-lg text-ink">Qanday ma&apos;lumot yig&apos;amiz</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-ink">Telefon raqam</strong> — ro&apos;yxatdan
              o&apos;tish va kirish uchun. Parol saqlanmaydi.
            </li>
            <li>
              <strong className="text-ink">Ism</strong> — xaridor sizni shu nom bilan
              ko&apos;radi.
            </li>
            <li>
              <strong className="text-ink">Hudud va tuman</strong> — e&apos;lonni
              hududiy filtrlash uchun.
            </li>
            <li>
              <strong className="text-ink">E&apos;lon ma&apos;lumotlari</strong> — matn,
              rasm, narx, hajm.
            </li>
            <li>
              <strong className="text-ink">Statistika</strong> — e&apos;lon necha marta
              ko&apos;rilgani va qo&apos;ng&apos;iroq tugmasi necha marta bosilgani.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg text-ink">Telefon raqamingiz kimga ko&apos;rinadi</h2>
          <p className="mt-2">
            E&apos;lon joylaganingizda telefon raqamingiz o&apos;sha e&apos;lon sahifasida
            ochiq ko&apos;rinadi — xaridor sizga qo&apos;ng&apos;iroq qilishi uchun
            aynan shu kerak. E&apos;lon joylamasangiz, raqamingiz hech kimga
            ko&apos;rinmaydi.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Nima qilmaymiz</h2>
          <p className="mt-2">
            Ma&apos;lumotlaringizni uchinchi shaxslarga sotmaymiz va reklama uchun
            bermaymiz.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Saqlash joyi</h2>
          <p className="mt-2">
            Foydalanuvchi ma&apos;lumotlari O&apos;zbekiston Respublikasi hududidagi
            serverlarda saqlanadi.
          </p>
        </section>

        <section>
          <h2 className="text-lg text-ink">Hisobni o&apos;chirish</h2>
          <p className="mt-2">
            Hisobingizni va e&apos;lonlaringizni istalgan vaqtda o&apos;chirishingiz
            mumkin. Buning uchun profil bo&apos;limidagi &laquo;Yordam&raquo; orqali
            murojaat qiling.
          </p>
        </section>
      </div>
    </article>
  );
}
