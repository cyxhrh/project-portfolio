# Venture Compass Opening Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a black-and-white, skip-safe opening overlay that introduces Venture Compass on every initial page load before the exploration screen becomes interactive.

**Architecture:** `OpeningExperience` is a focused React component that owns only its animation phases, timeout cleanup, skip controls, and reduced-motion fallback. `App` keeps the route and research state, conditionally renders this component on its initial mount, and only mounts the app shell after receiving `onComplete`. CSS defines the visual timeline so no video, GIF, or animation library is needed.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library, CSS keyframe animations.

**Spec:** `docs/superpowers/specs/2026-08-23-venture-compass-opening-design.md`

## Global Constraints

- Execute after the application foundation in `docs/superpowers/plans/2026-08-23-venture-compass-frontend.md` has created `src/app/App.tsx`, `src/app/App.test.tsx`, and the global CSS entry point.
- Play on every initial page load. Do not persist a “seen intro” flag.
- Use only `#000000` and `#FFFFFF`; do not use green, gradients, shadows, icons, audio, video, GIFs, or fake loading progress.
- Render the English wordmark as `Venture Compass` and the exact Chinese line `用数据，找到值得验证的跨境商品机会`.
- Normal timeline is 2.8 seconds; click anywhere or `Escape` skips immediately.
- With `prefers-reduced-motion: reduce`, show static wordmark and copy for 0.6 seconds, then enter the app.
- The overlay must unmount after completion and must not leave an interactive layer over the exploration screen.

---

## File Structure

```
src/
  app/
    App.tsx                         # Owns initial intro visibility and mounts the app shell after completion
    App.test.tsx                    # Verifies intro gating and app-shell handoff
  components/
    OpeningExperience.tsx           # Self-contained timeline, skip actions, motion preference, timeout cleanup
    OpeningExperience.test.tsx      # Component behavior and accessibility tests
  styles/
    opening-experience.css          # Monochrome layout and keyframes for the approved storyboard
```

### Task 1: Add the opening experience component and its behavior tests

**Files:**
- Create: `src/components/OpeningExperience.tsx`
- Create: `src/components/OpeningExperience.test.tsx`
- Create: `src/styles/opening-experience.css`

**Interfaces:**
- Produces: `OpeningExperience({ onComplete }: { onComplete: () => void }): JSX.Element`.
- Produces: an accessible full-viewport button-like opening surface that calls `onComplete` exactly once after the normal or reduced-motion duration, any pointer activation, or `Escape`.
- Consumes: browser `window.matchMedia('(prefers-reduced-motion: reduce)')` when available.

- [ ] **Step 1: Write the failing behavior tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { OpeningExperience } from './OpeningExperience';

describe('OpeningExperience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => vi.useRealTimers());

  test('shows the approved wordmark and Chinese value statement', () => {
    render(<OpeningExperience onComplete={vi.fn()} />);
    expect(screen.getByText('Venture Compass')).toBeInTheDocument();
    expect(screen.getByText('用数据，找到值得验证的跨境商品机会')).toBeInTheDocument();
  });

  test.each([
    ['pointer', () => fireEvent.pointerDown(screen.getByRole('button'))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('completes immediately on %s', (_, trigger) => {
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    trigger();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('completes after the 2.8 second normal timeline', () => {
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    vi.advanceTimersByTime(2799);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('uses the 0.6 second reduced-motion duration', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const onComplete = vi.fn();
    render(<OpeningExperience onComplete={onComplete} />);
    vi.advanceTimersByTime(600);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/components/OpeningExperience.test.tsx`

Expected: FAIL because `OpeningExperience.tsx` does not exist.

- [ ] **Step 3: Implement the component with one guarded completion path**

```tsx
import { useEffect, useRef } from 'react';
import '../styles/opening-experience.css';

type OpeningExperienceProps = { onComplete: () => void };

export function OpeningExperience({ onComplete }: OpeningExperienceProps) {
  const completed = useRef(false);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const duration = reduceMotion ? 600 : 2800;

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
    <button className={reduceMotion ? 'opening opening--reduced' : 'opening'} onPointerDown={complete} aria-label="跳过开场并进入商机罗盘">
      <span className="opening__dot" aria-hidden="true" />
      <span className="opening__line opening__line--left" aria-hidden="true" />
      <span className="opening__line opening__line--right" aria-hidden="true" />
      <span className="opening__wordmark">Venture Compass</span>
      <span className="opening__message">用数据，找到值得验证的跨境商品机会</span>
    </button>
  );
}
```

- [ ] **Step 4: Implement the monochrome storyboard CSS**

```css
.opening { position: fixed; inset: 0; z-index: 1000; display: grid; place-content: center; background: #000; color: #fff; border: 0; width: 100%; cursor: pointer; overflow: hidden; animation: opening-exit .3s 2.5s ease-in forwards; }
.opening__dot, .opening__line { position: absolute; top: 50%; left: 50%; background: #fff; }
.opening__dot { width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%); animation: opening-dot 1.2s ease-out both; }
.opening__line { width: 258px; height: 2px; transform-origin: center; animation: opening-line 0.7s 0.5s ease-in-out both; }
.opening__line--left { transform: translate(-100%, -50%); }
.opening__line--right { transform: translate(0, -50%); }
.opening__wordmark { font: 500 clamp(2rem, 5vw, 5.625rem)/1 'Helvetica Neue', Arial, sans-serif; letter-spacing: -0.02em; opacity: 0; animation: opening-wordmark 0.4s 1.2s ease-out forwards; }
.opening__message { margin-top: 1.5rem; font: 400 clamp(1rem, 1.5vw, 1.6875rem)/1.5 'Noto Sans SC', 'Microsoft YaHei', sans-serif; letter-spacing: .04em; opacity: 0; animation: opening-message 0.4s 1.6s ease-out forwards; }
.opening--reduced .opening__dot, .opening--reduced .opening__line { display: none; }
.opening--reduced .opening__wordmark, .opening--reduced .opening__message { animation: none; opacity: 1; }
@keyframes opening-dot { to { opacity: 0; } }
@keyframes opening-line { 0% { opacity: 0; } 25%, 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes opening-wordmark { to { opacity: 1; } }
@keyframes opening-message { to { opacity: 1; } }
@keyframes opening-exit { to { opacity: 0; } }
```

- [ ] **Step 5: Run the component tests to verify they pass**

Run: `npm run test -- --run src/components/OpeningExperience.test.tsx`

Expected: PASS with four tests.

- [ ] **Step 6: Commit the component work**

```bash
git add src/components/OpeningExperience.tsx src/components/OpeningExperience.test.tsx src/styles/opening-experience.css
git commit -m "feat: add venture compass opening experience"
```

### Task 2: Gate the application shell behind the opening experience

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `OpeningExperience` and its `onComplete` callback.
- Produces: the existing `App` interface, with the app shell rendered only after the intro completes.

- [ ] **Step 1: Extend the failing App test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

test('shows the shell after the opening experience is skipped', () => {
  render(<App />);
  expect(screen.getByText('Venture Compass')).toBeInTheDocument();
  expect(screen.queryByText('商机罗盘')).not.toBeInTheDocument();
  fireEvent.pointerDown(screen.getByRole('button', { name: '跳过开场并进入商机罗盘' }));
  expect(screen.getByText('商机罗盘')).toBeInTheDocument();
  expect(screen.queryByText('Venture Compass')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the App test to verify it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because the existing `App` renders the shell immediately.

- [ ] **Step 3: Add an initial intro gate to App**

```tsx
import { useState } from 'react';
import { OpeningExperience } from '../components/OpeningExperience';

export function App() {
  const [showOpening, setShowOpening] = useState(true);
  if (showOpening) return <OpeningExperience onComplete={() => setShowOpening(false)} />;
  return <AppShell /* retain all existing app-shell props */ />;
}
```

Keep all existing application route, locale, selected-category, and research state in `App`; only its initial render branch changes.

- [ ] **Step 4: Run focused and full checks**

Run: `npm run test -- --run src/components/OpeningExperience.test.tsx src/app/App.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Verify the approved visuals manually**

Run: `npm run dev`

Expected: On every browser refresh, the opening sequence has a black background, white point and two lines, `Venture Compass`, then the exact Chinese statement. Clicking, pressing `Escape`, and reduced-motion mode all reach the exploration page without an overlay remaining.

- [ ] **Step 6: Commit the integration**

```bash
git add src/app/App.tsx src/app/App.test.tsx
git commit -m "feat: show opening animation before exploration"
```

## Plan Self-Review

- Spec coverage: Tasks 1 and 2 cover the normal 2.8-second sequence, black-and-white visual restriction, wordmark and Chinese copy, pointer/Escape skip, reduced-motion fallback, automatic handoff, and DOM removal.
- Placeholder scan: no unassigned implementation work, placeholder interfaces, or unspecified tests remain.
- Type consistency: `OpeningExperienceProps.onComplete` is consumed with the same callback shape in the component tests and `App` integration.
