# 商业即想法地球主页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace visible research conditions with an idea-first globe homepage that accepts a business idea and demonstrates global expansion.

**Architecture:** `App` owns opening and locale. `ResearchForm` owns idea draft, submission status, and a ripple sequence. `CountryGlobe` remains the isolated 3D interaction and receives the sequence to briefly animate all preconfigured markets.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, react-globe.gl, Three.js, native CSS.

**Spec:** `docs/superpowers/specs/2026-08-28-idea-first-globe-home-design.md`

## Global Constraints

- Use a desktop-first white theme, ink text, gray globe, and the existing red marker accent.
- Chinese default copy is `每一个想法，都值得走向世界。`, `写下你的商业想法，从这里开始。`, and `寻找商业机会`.
- No backend, network request, fake result, condition form, progress page, or evidence drawer.
- Keep 1.7 auto-rotation and marker-hover pause; reduced motion disables rotation and ripple animation.
- Empty input uses native `disabled`; keyboard focus and CTA contrast remain accessible; visible copy has no em dash.

## File Structure

- Modify `src/app/copy.ts` for localized idea-home strings.
- Modify `src/app/App.tsx` to remove legacy visible research wiring.
- Modify `src/components/ResearchForm.tsx` for the manifesto, textarea, CTA, and status feedback.
- Modify `src/components/CountryGlobe.tsx` for a bounded global-pulse prop.
- Modify `src/styles/app.css` for the minimal landing composition.
- Modify `src/app/App.test.tsx` and `src/components/CountryGlobe.test.tsx` for behavior coverage.

### Task 1: Define copy and render the idea-first home

**Files:**
- Modify: `src/app/copy.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/components/ResearchForm.tsx`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Produces Copy fields: `ideaHomeTitle`, `ideaInputLabel`, `ideaPlaceholder`, `ideaExample`, `findOpportunity`, `ideaSubmitted`.
- Produces `ResearchForm({ locale: Locale })` with a numeric `pulseSequence` passed to `CountryGlobe`.

- [ ] **Step 1: Write failing user-facing page tests**

```tsx
expect(screen.getByRole('heading', { name: '每一个想法，都值得走向世界。' })).toBeVisible();
expect(screen.getByLabelText('商业想法')).toHaveAttribute(
  'placeholder',
  '例如：为经常出差的人做一款可折叠宠物饮水杯',
);
expect(screen.getByRole('button', { name: '寻找商业机会' })).toBeDisabled();
expect(screen.queryByLabelText('品类方向')).not.toBeInTheDocument();
expect(screen.queryByLabelText('目标国家')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL because the legacy condition title and fields still exist.

- [ ] **Step 3: Add exact bilingual strings and minimal state**

Add Chinese strings: `每一个想法，都值得走向世界。`, `商业想法`, `写下你的商业想法，从这里开始。`, `例如：为经常出差的人做一款可折叠宠物饮水杯`, `寻找商业机会`, `正在让你的想法走向全球。`. Add direct English equivalents.

Replace visible `ResearchInput` state with:

```tsx
const [idea, setIdea] = useState('');
const [pulseSequence, setPulseSequence] = useState(0);
const [submitted, setSubmitted] = useState(false);
const canSubmit = idea.trim().length > 0;

function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (!canSubmit) return;
  setSubmitted(true);
  setPulseSequence((value) => value + 1);
}
```

Render exactly one heading, one labeled textarea, one submit button, and a `role="status"` element after submit. Keep the globe region and accessible marker list. Do not navigate or add result content.

- [ ] **Step 4: Run focused page test**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS for empty-input disablement, visible homepage scope, and a nonempty submit that shows `正在让你的想法走向全球。` without a result heading.

- [ ] **Step 5: Commit**

Run: `git add src/app/copy.ts src/app/App.tsx src/components/ResearchForm.tsx src/app/App.test.tsx`

Run: `git commit -m "feat: add idea-first globe homepage"`

### Task 2: Trigger global ripple feedback safely

**Files:**
- Modify: `src/components/CountryGlobe.tsx`
- Modify: `src/components/CountryGlobe.test.tsx`

**Interfaces:**
- Consumes `pulseSequence?: number`.
- Produces `ringsData` containing every configured country during a 2.2-second submission pulse, otherwise preserving selected-country rings.

- [ ] **Step 1: Write the failing global-pulse test**

```tsx
const { rerender } = render(
  <CountryGlobe locale="en" countries={marketCountries} value="Japan" onSelect={vi.fn()} pulseSequence={0} />,
);
await screen.findByRole('button', { name: 'Visual Japan marker' });
rerender(
  <CountryGlobe locale="en" countries={marketCountries} value="Japan" onSelect={vi.fn()} pulseSequence={1} />,
);
expect(globeMock.props?.ringsData).toEqual(marketCountries);
```

Add an equivalent reduced-motion assertion that `ringsData` remains empty.

- [ ] **Step 2: Run failing globe test**

Run: `npm test -- src/components/CountryGlobe.test.tsx`

Expected: FAIL because `pulseSequence` and global pulse state do not exist.

- [ ] **Step 3: Add timer-safe ripple state**

```tsx
const [isGlobalPulseActive, setIsGlobalPulseActive] = useState(false);

useEffect(() => {
  if (!pulseSequence || reduceMotion) return undefined;
  setIsGlobalPulseActive(true);
  const timeout = window.setTimeout(() => setIsGlobalPulseActive(false), 2_200);
  return () => window.clearTimeout(timeout);
}, [pulseSequence, reduceMotion]);

const ringPoints = !reduceMotion
  ? isGlobalPulseActive ? countries : selectedCountry ? [selectedCountry] : []
  : [];
```

Pass `ringPoints` to `ringsData`. Preserve red circular markers, 3.6 hit targets, ring altitude, 1.7 rotation, drag, hover pause, and selection behavior.

- [ ] **Step 4: Run focused globe tests**

Run: `npm test -- src/components/CountryGlobe.test.tsx`

Expected: PASS for the new pulse plus all existing globe behavior.

- [ ] **Step 5: Commit**

Run: `git add src/components/CountryGlobe.tsx src/components/CountryGlobe.test.tsx`

Run: `git commit -m "feat: pulse global markets for submitted idea"`

### Task 3: Compose the minimal landing surface and verify

**Files:**
- Modify: `src/styles/app.css`
- Modify: `src/app/App.test.tsx` only for semantic structure assertions.

**Interfaces:**
- Consumes `research-form--idea-home` and the idea-form elements from Task 1.
- Produces a white page with title above a 720px globe and a foreground input panel.

- [ ] **Step 1: Add layout-scope test**

```tsx
expect(document.querySelector('.research-form')).toHaveClass('research-form--idea-home');
expect(document.querySelector('.vc-language-switch')).toHaveClass('vc-visually-hidden');
expect(document.querySelector('.research-form__column--left')).not.toBeInTheDocument();
expect(document.querySelector('.research-form__column--right')).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused page test**

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL until Task 1 removes legacy column markup and adds the focused form class.

- [ ] **Step 3: Implement CSS composition**

Center the title above the globe. Establish a local stacking context with the 720px globe behind a wide white form panel. Use a 1px `#111418` panel border, textarea min-height 84px, no pill corners, a dark high-contrast CTA, and clear focus styling. Keep red as the sole accent. In reduced-motion remove transitions but do not remove status feedback.

Do not add cards, gradients, icons, extra labels, scroll prompts, or simulated-result content.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run build`

Expected: all tests pass and TypeScript/Vite build succeeds.

- [ ] **Step 5: Run local visual verification**

Run: `npm run dev -- --host 127.0.0.1 --port 5177`

Check: after skipping opening, only brand, manifesto, globe, textarea, and CTA are visible; blank input cannot submit; submitting an idea runs global ripples; marker hover pauses rotation; reduced-motion stays usable.

- [ ] **Step 6: Commit**

Run: `git add src/styles/app.css src/app/App.test.tsx`

Run: `git commit -m "style: compose idea-first globe landing"`

## Plan Self-Review

- Tasks 1-3 cover all spec requirements: visible scope, input validation, demo-only feedback, global ripple, current globe behavior, reduced motion, focus, contrast, and build verification.
- `pulseSequence?: number` is defined in Task 2 and consumed in Task 1; copy fields are defined before markup consumes them.
- The plan has no TODO, TBD, or undefined handoff.
