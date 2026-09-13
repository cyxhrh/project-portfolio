import { lazy, Suspense, useState } from 'react';
import { copy } from '../app/copy';
import { marketCountries } from '../app/marketCountries';
import type { Locale } from '../app/types';

const CountryGlobe = lazy(() => import('./CountryGlobe').then((module) => ({
  default: module.CountryGlobe,
})));
const SINKSIDE_CAMPAIGN_URL = '/sinkside/index.html';

export type ResearchFormProps = {
  locale: Locale;
  onNavigate?: (url: string) => void;
};

export function ResearchForm({ locale, onNavigate }: ResearchFormProps) {
  const [idea, setIdea] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>(marketCountries[0].id);
  const text = copy[locale];
  const canSubmit = idea.trim().length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    if (onNavigate) {
      onNavigate(SINKSIDE_CAMPAIGN_URL);
      return;
    }

    document.getElementById('sinkside-campaign-link')?.click();
  }

  return (
    <section className="research-conditions" aria-labelledby="idea-home-title">
      <div className="research-conditions__intro">
        <h1 id="idea-home-title">{text.ideaHomeTitle}</h1>
      </div>
      <div className="research-conditions__layout">
        <form
          action={SINKSIDE_CAMPAIGN_URL}
          className="research-form research-form--idea-home"
          aria-labelledby="idea-home-title"
          onSubmit={handleSubmit}
          target="_self"
        >
          <Suspense
            fallback={(
              <section className="country-globe country-globe--loading" aria-label={text.globeInteractionLabel}>
                <p className="country-globe__fallback" role="status">{text.globeLoading}</p>
              </section>
            )}
          >
            <CountryGlobe
              locale={locale}
              countries={marketCountries}
              value={selectedCountry}
              onSelect={setSelectedCountry}
            />
          </Suspense>

          <div className="idea-composer" role="group" aria-labelledby="idea-input-prompt">
            <p className="idea-composer__prompt" id="idea-input-prompt">{text.ideaPlaceholder}</p>
            <label className="idea-composer__field">
              <span className="vc-visually-hidden">{text.ideaInputLabel}</span>
              <textarea
                aria-describedby="idea-input-prompt"
                placeholder={text.ideaExample}
                value={idea}
                onChange={(event) => setIdea(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

                  event.preventDefault();
                  if (canSubmit) event.currentTarget.form?.requestSubmit();
                }}
              />
            </label>
            <a
              className="idea-composer__campaign-link"
              href={SINKSIDE_CAMPAIGN_URL}
              id="sinkside-campaign-link"
              onClick={(event) => {
                if (!onNavigate) return;
                event.preventDefault();
                onNavigate(SINKSIDE_CAMPAIGN_URL);
              }}
            >
              {text.findOpportunity}
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}
