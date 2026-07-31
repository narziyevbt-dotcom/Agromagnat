import Link from 'next/link';
import { t } from '@/lib/strings';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-hairline bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-7" />
              <span className="font-[family-name:var(--font-display)] text-base font-bold text-cobalt">
                {t.brand}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">{t.tagline}</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
            <Link href="/haqida" className="hover:text-cobalt">
              {t.footer.about}
            </Link>
            <Link href="/shartlar" className="hover:text-cobalt">
              {t.footer.terms}
            </Link>
            <Link href="/maxfiylik" className="hover:text-cobalt">
              {t.footer.privacy}
            </Link>
          </nav>
        </div>

        <p className="mt-6 text-xs text-ink-faint">
          © {new Date().getFullYear()} {t.brand}. {t.footer.rights}.
        </p>
      </div>
    </footer>
  );
}
