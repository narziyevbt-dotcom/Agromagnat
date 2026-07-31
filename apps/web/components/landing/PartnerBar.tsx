/**
 * Grayscale partner ticker.
 *
 * The names below are placeholders for organisations the platform has not
 * partnered with — they are set as generic sector labels rather than real
 * company marks, because putting a real logo here before an agreement exists
 * would be a claim the product cannot back. Swap in real marks as partnerships
 * are signed.
 */
const PARTNERS = [
  'Fermer uyushmasi',
  'Agro klaster',
  'Urug‘ markazi',
  'Logistika xizmati',
  'Ombor tarmog‘i',
  'Agro bank',
];

export function PartnerBar() {
  // Rendered twice so the marquee wraps seamlessly.
  const track = [...PARTNERS, ...PARTNERS];

  return (
    <section className="border-y border-slate-line bg-white py-7">
      <p className="mb-5 text-center text-xs font-medium tracking-wide text-ink-faint uppercase">
        Agro soha yetakchilari ishonchi
      </p>

      <div
        className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        aria-hidden="true"
      >
        <ul className="flex w-max animate-[marquee_38s_linear_infinite] items-center gap-12 px-6">
          {track.map((name, index) => (
            <li
              key={`${name}-${index}`}
              className="shrink-0 text-base font-semibold whitespace-nowrap text-slate-400 grayscale transition-colors hover:text-slate-500"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>

      {/* The same list, readable by assistive tech without the animation. */}
      <ul className="sr-only">
        {PARTNERS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  );
}
