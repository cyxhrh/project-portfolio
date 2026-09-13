import { useEffect, useState } from 'react';
import { copy } from '../app/copy';
import type { CategoryScene, Locale, ResearchInput } from '../app/types';

export type ResearchProgressProps = {
  locale: Locale;
  status: 'loading' | 'insufficient' | 'error';
  category: CategoryScene;
  researchInput: ResearchInput;
  onComplete: () => void;
  onBack: () => void;
  onRetry: () => void;
};

const progressStages = ['trend', 'competition', 'budget', 'evidence'] as const;

export function ResearchProgress({ locale, status, category, researchInput, onComplete, onBack, onRetry }: ResearchProgressProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const text = copy[locale];
  const stageLabels = [text.progressTrend, text.progressCompetition, text.progressBudget, text.progressEvidence];

  useEffect(() => {
    if (status !== 'loading') return;

    const timers = progressStages.map((_, index) => window.setTimeout(
      index === progressStages.length - 1 ? onComplete : () => setStageIndex(index + 1),
      (index + 1) * 800,
    ));

    return () => timers.forEach(window.clearTimeout);
  }, [onComplete, status]);

  if (status !== 'loading') {
    const message = status === 'insufficient' ? text.insufficientData : text.error;

    return (
      <section className="research-progress" aria-labelledby="research-progress-title">
        <div className="research-progress__visual" aria-hidden="true">
          <img src={category.imageUrl} alt="" />
        </div>
        <div className="research-progress__content research-progress__content--recovery">
          <p className="vc-eyebrow">VENTURE COMPASS</p>
          <h1 id="research-progress-title">{message}</h1>
          <p>{text.researchingTitle(researchInput.country, researchInput.platform)}</p>
          <div className="research-progress__actions">
            <button type="button" onClick={onBack}>{text.backToConditions}</button>
            <button type="button" onClick={onRetry}>{text.retryResearch}</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="research-progress" aria-labelledby="research-progress-title">
      <div className="research-progress__visual" aria-hidden="true">
        <img src={category.imageUrl} alt="" />
      </div>
      <div className="research-progress__content">
        <p className="vc-eyebrow">VENTURE COMPASS</p>
        <h1 id="research-progress-title">{text.researchingTitle(researchInput.country, researchInput.platform)}</h1>
        <p className="research-progress__notice">{text.researchSimulationNotice}</p>
        <p className="vc-visually-hidden" role="status" aria-atomic="true" aria-live="polite">
          {text.progressAnnouncement(stageLabels[stageIndex])}
        </p>
        <ol className="research-progress__stages" aria-label={text.researchingDescription}>
          {progressStages.map((stage, index) => (
            <li
              aria-current={index === stageIndex ? 'step' : undefined}
              key={stage}
              data-current={index === stageIndex}
            >
              {stageLabels[index]}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
