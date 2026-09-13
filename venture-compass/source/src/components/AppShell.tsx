import type { ReactNode } from 'react';
import { copy } from '../app/copy';
import type { Locale } from '../app/types';

type AppShellProps = {
  children: ReactNode;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onHome: () => void;
  minimal?: boolean;
};

export function AppShell({ children, locale, onLocaleChange, onHome, minimal = false }: AppShellProps) {
  const text = copy[locale];

  return (
    <div className="vc-app-shell">
      <header className="vc-topbar">
        <a
          className="vc-brand"
          href="#main-content"
          aria-label={text.homeLabel}
          onClick={onHome}
        >
          <span>Venture Compass</span>
        </a>
        <nav className={`vc-language-switch${minimal ? ' vc-visually-hidden' : ''}`} aria-label={text.languageLabel}>
          <button
            className="vc-language-button"
            type="button"
            aria-pressed={locale === 'zh'}
            onClick={() => onLocaleChange('zh')}
          >
            {text.languageChinese}
          </button>
          <button
            className="vc-language-button"
            type="button"
            aria-pressed={locale === 'en'}
            onClick={() => onLocaleChange('en')}
          >
            {text.languageEnglish}
          </button>
        </nav>
      </header>
      <main id="main-content">{children}</main>
    </div>
  );
}
