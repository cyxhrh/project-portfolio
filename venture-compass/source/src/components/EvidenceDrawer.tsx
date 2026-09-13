import {
  Button,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
} from '@fluentui/react-components';
import { copy } from '../app/copy';
import type { CategoryScene, EvidenceItem, Locale, Opportunity, ResearchInput } from '../app/types';

export type EvidenceDrawerProps = {
  locale: Locale;
  category: CategoryScene;
  opportunity: Opportunity;
  researchInput: ResearchInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const evidenceLabel = (item: EvidenceItem, locale: Locale) => {
  const text = copy[locale];

  return {
    trend: text.evidenceTrend,
    competition: text.evidenceCompetition,
    price: text.evidencePrice,
    reviews: text.evidenceReviews,
    collection: text.evidenceCollection,
  }[item.type];
};

export function EvidenceDrawer({ locale, category, opportunity, researchInput, open, onOpenChange }: EvidenceDrawerProps) {
  const text = copy[locale];
  const coverage = text.researchCoverage(
    category.title[locale],
    `${researchInput.currency} ${researchInput.budget}`,
    researchInput.country,
    researchInput.platform,
  );

  return (
    <Drawer
      aria-label={text.evidenceDialogLabel}
      className="evidence-drawer"
      type="overlay"
      position="end"
      size="medium"
      open={open}
      onOpenChange={(_, data) => onOpenChange(data.open)}
    >
      <DrawerHeader>
        <DrawerHeaderTitle
          action={(
            <Button
              appearance="subtle"
              aria-label={text.close}
              className="evidence-drawer__close"
              onClick={() => onOpenChange(false)}
            >
              ×
            </Button>
          )}
        >
          {text.evidenceTitle(opportunity.name)}
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        <p className="evidence-drawer__notice">{text.illustrativeNotice}</p>
        <section className="evidence-drawer__coverage" aria-labelledby="evidence-coverage-title">
          <h3 id="evidence-coverage-title">{text.coverageNote}</h3>
          <p>{coverage}</p>
        </section>
        <div className="evidence-drawer__list">
          {opportunity.evidence.map((item) => (
            <article className="evidence-item" key={item.type}>
              <p className="evidence-item__type">{evidenceLabel(item, locale)}</p>
              <h3>{item.summary}</h3>
              <p className="evidence-item__metric">{item.metric}</p>
              <dl>
                <div>
                  <dt>{text.source}</dt>
                  <dd>
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                      {item.sourceName} · {text.openSource}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>{text.collectedAt}</dt>
                  <dd>{item.collectedAt}</dd>
                </div>
                {item.coverageNote && (
                  <div>
                    <dt>{text.coverageNote}</dt>
                    <dd>{item.coverageNote}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
        </div>
      </DrawerBody>
    </Drawer>
  );
}
