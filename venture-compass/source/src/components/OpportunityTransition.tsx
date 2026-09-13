import { useEffect, useRef, useState } from 'react';
import '../styles/opportunity-transition.css';

type OpportunityTransitionProps = {
  onComplete: () => void;
};

type TransitionStage = 'routine' | 'space' | 'result';

const stageCopy: Record<TransitionStage, string> = {
  routine: 'READING DAILY USE',
  space: 'MAPPING THE SPACE',
  result: 'MATCH FOUND',
};

const NORMAL_DURATION = 3000;
const REDUCED_DURATION = 250;

export function OpportunityTransition({ onComplete }: OpportunityTransitionProps) {
  const [reduceMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const [stage, setStage] = useState<TransitionStage>(reduceMotion ? 'result' : 'routine');
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    statusRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const timers: number[] = [];

    if (!reduceMotion) {
      timers.push(window.setTimeout(() => setStage('space'), 900));
      timers.push(window.setTimeout(() => setStage('result'), 2100));
    }

    timers.push(window.setTimeout(onComplete, reduceMotion ? REDUCED_DURATION : NORMAL_DURATION));

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onComplete, reduceMotion]);

  return (
    <div
      className={reduceMotion ? 'opportunity-transition opportunity-transition--reduced' : 'opportunity-transition'}
      data-stage={stage}
    >
      <div className="opportunity-transition__analysis" aria-hidden="true">
        <span className="opportunity-transition__axis opportunity-transition__axis--horizontal" />
        <span className="opportunity-transition__axis opportunity-transition__axis--vertical" />
        <span className="opportunity-transition__signal" />
        <span className="opportunity-transition__ring" />
        <span className="opportunity-transition__orbit opportunity-transition__orbit--outer">
          <span />
        </span>
        <span className="opportunity-transition__orbit opportunity-transition__orbit--inner">
          <span />
        </span>
        <span className="opportunity-transition__grid" />
        <span className="opportunity-transition__pipe" />
        <span className="opportunity-transition__measure opportunity-transition__measure--width" />
        <span className="opportunity-transition__measure opportunity-transition__measure--height" />
      </div>

      <div className="opportunity-transition__result" aria-hidden="true">
        <img src="/sinkside/assets/images/after-cabinet.png" alt="" />
        <span className="opportunity-transition__shade" />
        <span className="opportunity-transition__shutter opportunity-transition__shutter--left" />
        <span className="opportunity-transition__shutter opportunity-transition__shutter--right" />
        <span className="opportunity-transition__mark" />
      </div>

      <p
        ref={statusRef}
        className="opportunity-transition__status"
        role="status"
        aria-live="polite"
        aria-label="Opportunity analysis"
        tabIndex={-1}
      >
        <span key={stage}>{stageCopy[stage]}</span>
      </p>
    </div>
  );
}
