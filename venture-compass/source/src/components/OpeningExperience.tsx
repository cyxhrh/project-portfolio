import { useEffect, useRef } from 'react';
import '../styles/opening-experience.css';

type OpeningExperienceProps = { onComplete: () => void };

export function OpeningExperience({ onComplete }: OpeningExperienceProps) {
  const completed = useRef(false);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const duration = reduceMotion ? 600 : 3700;

  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  useEffect(() => {
    const timer = window.setTimeout(complete, duration);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') complete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [duration]);

  return (
    <button className={reduceMotion ? 'opening opening--reduced' : 'opening'} onPointerDown={complete} onClick={complete} aria-label="跳过开场并进入商机罗盘">
      <span className="opening__dot" aria-hidden="true" />
      <span className="opening__line opening__line--left" aria-hidden="true" />
      <span className="opening__line opening__line--right" aria-hidden="true" />
      <span className="opening__wordmark">Venture Compass</span>
      <span className="opening__message">用数据，找到值得验证的跨境商品机会</span>
    </button>
  );
}
