import { MessageSquare, PhoneCall } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Honest placeholder: the chat feature is not built yet, and pretending
 * otherwise with a dead inbox would be worse than saying so. The page points
 * at the channel that does work today — the call button.
 */
export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl">Xabarlar</h1>

      <div className="mt-5 rounded-2xl border border-slate-line bg-white p-10 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-turquoise/10 text-turquoise">
          <MessageSquare className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg">Ichki chat tez orada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Xaridorlar bilan yozishmalar ustida ishlayapmiz. Hozircha xaridorlar siz
          bilan to&apos;g&apos;ridan-to&apos;g&apos;ri telefon orqali bog&apos;lanadi —
          e&apos;lonlaringizdagi <PhoneCall className="inline h-3.5 w-3.5" aria-hidden="true" />{' '}
          &laquo;Qo&apos;ng&apos;iroq qilish&raquo; tugmasi ishlaydi.
        </p>
      </div>
    </div>
  );
}
