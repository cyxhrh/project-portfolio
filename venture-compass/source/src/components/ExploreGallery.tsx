import { useRef, useState, type CSSProperties, type KeyboardEvent, type TransitionEvent, type WheelEvent } from 'react';
import { copy } from '../app/copy';
import type { CategoryScene, Locale } from '../app/types';

type ExploreGalleryProps = {
  locale: Locale;
  scenes: CategoryScene[];
  onSelectCategory: (categoryId: string) => void;
};

export function ExploreGallery({ locale, scenes, onSelectCategory }: ExploreGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(scenes.length);
  const [isTrackAnimated, setIsTrackAnimated] = useState(true);
  const lastWheelAt = useRef(0);
  const text = copy[locale];
  const scene = scenes[activeIndex];

  if (!scene) return null;

  const move = (offset: number) => {
    setActiveIndex((current) => (current + offset + scenes.length) % scenes.length);
    setTrackIndex((current) => current + offset);
  };

  const selectThumbnail = (index: number) => {
    setActiveIndex(index);
    setTrackIndex(scenes.length + index);
  };

  const handleTrackTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform') return;

    if (trackIndex >= scenes.length && trackIndex < scenes.length * 2) return;
    const normalizedIndex = ((trackIndex % scenes.length) + scenes.length) % scenes.length;
    const resetIndex = scenes.length + normalizedIndex;

    setIsTrackAnimated(false);
    setTrackIndex(resetIndex);
    requestAnimationFrame(() => requestAnimationFrame(() => setIsTrackAnimated(true)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const now = Date.now();
    if (Math.abs(movement) < 20 || now - lastWheelAt.current < 450) return;
    lastWheelAt.current = now;
    move(movement < 0 ? -1 : 1);
  };

  return (
    <section
      className="explore-stage"
      aria-label={text.exploreTitle}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      >
      <div className="explore-visual" data-hero-visual="image-first" data-scene={scene.id}>
        <img className="explore-scene-image" src={scene.imageUrl} alt={scene.imageAlt[locale]} />
        <div className="explore-shade" aria-hidden="true" />
      </div>

      <div className="explore-intro">
        <p className="vc-eyebrow">{text.foundationEyebrow}</p>
        <p>{text.exploreTitle}</p>
      </div>

      <div className="scene-copy" data-hero-copy="image-first" aria-live="polite">
        <p className="scene-kicker">{scene.subtitle[locale]}</p>
        <h1>{scene.title[locale]}</h1>
        <p className="scene-description">{scene.description[locale]}</p>
        <button
          className="scene-select"
          type="button"
          onClick={() => onSelectCategory(scene.id)}
        >
          <span>{scene.selectLabel[locale]}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>

      <div className="scene-rail" aria-label={text.thumbnailRail}>
        <div
          className={`scene-rail-track${isTrackAnimated ? ' is-animated' : ''}`}
          style={{ '--track-translate': `calc(-${(trackIndex + 0.5) * 10}vw - ${trackIndex * 8}px)` } as CSSProperties}
          onTransitionEnd={handleTrackTransitionEnd}
        >
          {[0, 1, 2].map((copyIndex) => (
            <div
              className="scene-rail-copy"
              key={copyIndex}
              aria-hidden={copyIndex === 1 ? undefined : 'true'}
            >
              {scenes.map((item, index) => {
                const absoluteIndex = copyIndex * scenes.length + index;
                const isAccessibleCopy = copyIndex === 1;
                return (
                  <button
                    className="scene-thumbnail"
                    type="button"
                    key={`${copyIndex}-${item.id}`}
                    aria-label={isAccessibleCopy ? text.viewDirection(item.title[locale]) : undefined}
                    aria-current={isAccessibleCopy && index === activeIndex ? 'true' : undefined}
                    data-active={absoluteIndex === trackIndex ? 'true' : undefined}
                    tabIndex={isAccessibleCopy ? 0 : -1}
                    onClick={() => selectThumbnail(index)}
                  >
                    <img className="scene-thumbnail-image" src={item.imageUrl} alt={item.imageAlt[locale]} />
                    <span className="scene-thumbnail-index" aria-hidden="true">0{index + 1}</span>
                    <span>{item.title[locale]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="scene-selection-frame" data-testid="fixed-selection-frame" aria-hidden="true" />
      </div>
    </section>
  );
}
