import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { OpportunityTransition } from '../components/OpportunityTransition';
import { OpeningExperience } from '../components/OpeningExperience';
import { ResearchForm } from '../components/ResearchForm';
import type { Locale } from './types';

export type AppProps = {
  onNavigate?: (url: string) => void;
};

export function App({ onNavigate }: AppProps = {}) {
  const [showOpening, setShowOpening] = useState(true);
  const [locale, setLocale] = useState<Locale>('zh');
  const [transitionTarget, setTransitionTarget] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const startCampaignTransition = useCallback((url: string) => {
    setTransitionTarget((currentTarget) => currentTarget ?? url);
  }, []);

  const completeCampaignTransition = useCallback(() => {
    if (!transitionTarget) return;

    const target = transitionTarget;

    if (onNavigate) {
      setTransitionTarget(null);
      onNavigate(target);
      return;
    }

    window.location.assign(target);
  }, [onNavigate, transitionTarget]);

  return (
    <>
      <div
        className={showOpening ? 'vc-shell-underlay vc-shell-underlay--revealing' : 'vc-shell-underlay'}
        aria-hidden={showOpening || Boolean(transitionTarget)}
        inert={showOpening || Boolean(transitionTarget) || undefined}
      >
        <AppShell
          locale={locale}
          minimal
          onLocaleChange={setLocale}
          onHome={() => undefined}
        >
          <ResearchForm locale={locale} onNavigate={startCampaignTransition} />
        </AppShell>
      </div>
      {showOpening && <OpeningExperience onComplete={() => setShowOpening(false)} />}
      {transitionTarget && <OpportunityTransition onComplete={completeCampaignTransition} />}
    </>
  );
}
