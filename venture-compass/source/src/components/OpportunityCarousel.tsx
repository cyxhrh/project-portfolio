import { useEffect, useState } from 'react';
import { copy } from '../app/copy';
import type { CategoryScene, Locale, Opportunity, ResearchInput } from '../app/types';
import { EvidenceDrawer } from './EvidenceDrawer';

export type OpportunityCarouselProps = {
  locale: Locale;
  category: CategoryScene;
  researchInput: ResearchInput;
  opportunities: Opportunity[];
  onEditConditions: () => void;
};

export function OpportunityCarousel({
  locale,
  category,
  researchInput,
  opportunities,
  onEditConditions,
}: OpportunityCarouselProps) {
  const candidates = opportunities.slice(0, 3);
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const text = copy[locale];
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];

  useEffect(() => {
    if (!candidates.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? '');
      setDrawerOpen(false);
    }
  }, [candidates, selectedId]);

  if (!selected) return null;

  return (
    <section className="opportunities" aria-labelledby="opportunities-title">
      <div className="opportunities__header">
        <div>
          <p className="vc-eyebrow">VENTURE COMPASS / ILLUSTRATIVE</p>
          <h1 id="opportunities-title">{text.opportunitiesTitle}</h1>
          <p>{text.opportunitiesDescription(
            category.title[locale],
            `${researchInput.currency} ${researchInput.budget}`,
            researchInput.country,
            researchInput.platform,
          )}</p>
        </div>
        <button className="opportunities__edit" type="button" onClick={onEditConditions}>
          {text.editConditions}
        </button>
      </div>

      <p className="opportunities__notice">{text.illustrativeNotice}</p>

      <div className="opportunity-carousel" aria-label={text.opportunitiesTitle}>
        {candidates.map((candidate, index) => (
          <button
            aria-label={text.candidateDirection(index + 1, candidate.name)}
            aria-pressed={candidate.id === selected.id}
            className="opportunity-card"
            data-selected={candidate.id === selected.id}
            key={candidate.id}
            type="button"
            onClick={() => setSelectedId(candidate.id)}
          >
            <span className="opportunity-card__index">0{index + 1}</span>
            <span className="opportunity-card__visual" aria-hidden="true">{candidate.visualPlaceholder}</span>
            <span className="opportunity-card__name">{candidate.name}</span>
            <span className="opportunity-card__score">{text.opportunityScore} · {candidate.score}/100</span>
          </button>
        ))}
      </div>

      <article className="opportunity-detail" aria-live="polite">
        <div className="opportunity-detail__lead">
          <p className="opportunity-detail__score">{selected.score}<span>/100</span></p>
          <div>
            <p className="vc-eyebrow">{text.opportunityScore}</p>
            <h2>{selected.name}</h2>
          </div>
        </div>
        <ul>
          {selected.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
        <div className="opportunity-detail__considerations">
          <div>
            <h3>{text.budgetFit}</h3>
            <p>{selected.budgetFit}</p>
          </div>
          <div>
            <h3>{text.primaryRisk}</h3>
            <p>{selected.risk}</p>
          </div>
        </div>
        <button className="opportunity-detail__evidence" type="button" onClick={() => setDrawerOpen(true)}>
          {text.viewEvidence}
        </button>
      </article>

      <EvidenceDrawer
        locale={locale}
        category={category}
        opportunity={selected}
        researchInput={researchInput}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </section>
  );
}
