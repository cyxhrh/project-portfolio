# Venture Compass Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable desktop-first bilingual frontend prototype for Venture Compass, from horizontal category exploration through evidence-backed opportunity comparison.

**Architecture:** A Vite React single-page application holds a small route/state machine in `App.tsx`. Feature components receive typed mock data and callback props, so the future API layer can replace only the mock data provider. The deep graphite visual system is expressed as CSS variables and shared primitives, while Fluent UI supplies accessible controls and the evidence drawer.

**Tech Stack:** React, TypeScript, Vite, Fluent UI React v9, CSS variables, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-venture-compass-design.md`

## Global Constraints

- Build a desktop-first 1440px demonstration. Mobile optimization is not a first-version requirement.
- Provide a Chinese default with a top-level Chinese / English switch that changes all interface copy.
- Use one deep graphite page theme and one low-saturation teal accent. Do not mix light and dark page sections.
- The horizontal explorer is for choosing an interest category. Agent results remain data-driven recommendations.
- Use clear image placeholders with Chinese descriptions for every visual asset slot. Do not present placeholders as market evidence.
- Use mock research data only. Do not imply that scores, sources, or dates are live facts.
- Include loading, insufficient-data, and error states.
- Do not build authentication, orders, payments, logistics, crawlers, scoring logic, agent integrations, or validation-plan features.
- Page copy uses regular hyphens when needed and contains no em dash or en dash characters.

---

## File Structure

```
src/
  app/
    App.tsx                         # Flow state and page orchestration
    types.ts                         # Shared input, opportunity, evidence, and screen types
    mockData.ts                      # Category scenes and illustrative research response
    copy.ts                          # Chinese and English copy dictionaries
  components/
    AppShell.tsx                     # Header, language switch, navigation frame
    ExploreGallery.tsx               # Horizontal category experience and thumbnail rail
    ResearchForm.tsx                 # Research condition input and validation
    ResearchProgress.tsx             # Staged research, error, and insufficient-data states
    OpportunityCarousel.tsx          # Three opportunities and compact comparison rail
    EvidenceDrawer.tsx               # Right-side evidence surface
    ImagePlaceholder.tsx             # Explicit visual asset placeholder
  styles/
    tokens.css                       # Color, spacing, typography, and motion tokens
    app.css                          # Layout and component styling
  main.tsx
  test/setup.ts
  app/App.test.tsx
index.html
vite.config.ts
package.json
```

## Task 1: Initialize the React application and visual foundation

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, and `npm run test` commands.
- Produces: global CSS tokens `--vc-bg`, `--vc-surface`, `--vc-text`, and `--vc-accent` for every later component.

- [ ] **Step 1: Write the failing shell test**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the Chinese Venture Compass shell', () => {
  render(<App />);
  expect(screen.getByText('商机罗盘')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify the missing application fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 3: Create the Vite and Vitest configuration**

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
});
```

```ts
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webDarkTheme } from '@fluentui/react-components';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><FluentProvider theme={webDarkTheme}><App /></FluentProvider></StrictMode>,
);
```

```css
/* src/styles/tokens.css */
:root {
  --vc-bg: #111719;
  --vc-surface: #182123;
  --vc-surface-muted: #202a2c;
  --vc-text: #f1f5f3;
  --vc-text-muted: #aeb9b6;
  --vc-accent: #72cdb2;
  --vc-radius: 16px;
  font-family: 'Noto Sans SC', 'Geist', system-ui, sans-serif;
  background: var(--vc-bg);
  color: var(--vc-text);
}
```

- [ ] **Step 4: Add dependencies and run the test**

Run: `npm install react react-dom @fluentui/react-components && npm install -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL only because the `App` implementation is still absent.

- [ ] **Step 5: Commit the initialized foundation**

```bash
git add package.json package-lock.json vite.config.ts index.html src
git commit -m "feat: initialize venture compass frontend"
```

## Task 2: Define typed mock data and bilingual copy

**Files:**
- Create: `src/app/types.ts`
- Create: `src/app/copy.ts`
- Create: `src/app/mockData.ts`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Produces: `Locale = 'zh' | 'en'`, `ResearchInput`, `Opportunity`, and `EvidenceItem`.
- Produces: `copy.zh` and `copy.en` with all visible UI strings used by components.
- Produces: `categoryScenes` and `demoOpportunities` used by the gallery and result screens.

- [ ] **Step 1: Write the failing localization test**

```tsx
test('switches the shell language to English', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Venture Compass')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because no language state or English button exists.

- [ ] **Step 3: Add the shared domain types and non-factual mock response**

```ts
export type Locale = 'zh' | 'en';
export type ResearchInput = { categoryId: string; budget: number; currency: 'CNY'; country: string; platform: string };
export type EvidenceItem = { type: 'trend' | 'competition' | 'price' | 'reviews' | 'collection'; summary: string; metric: string; sourceName: string; sourceUrl: string; collectedAt: string; coverageNote?: string };
export type Opportunity = { id: string; name: string; score: number; reasons: string[]; budgetFit: string; risk: string; visualPlaceholder: string; evidence: EvidenceItem[] };
```

Populate three clearly labeled illustrative clothing opportunities for `CNY 5000`, United States, and TikTok Shop. Use source names such as `示例来源` and `Illustrative source`, with `https://example.com` URLs so the template cannot imply live data.

- [ ] **Step 4: Implement the copy dictionary and header language state**

```tsx
const [locale, setLocale] = useState<Locale>('zh');
<button aria-pressed={locale === 'zh'} onClick={() => setLocale('zh')}>中文</button>
<button aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>English</button>
```

- [ ] **Step 5: Run the localization test and commit**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: PASS.

```bash
git add src/app
git commit -m "feat: add typed mock opportunity data and bilingual copy"
```

## Task 3: Build the horizontal business-direction explorer

**Files:**
- Create: `src/components/AppShell.tsx`
- Create: `src/components/ImagePlaceholder.tsx`
- Create: `src/components/ExploreGallery.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `Locale`, `categoryScenes`, and an `onSelectCategory(categoryId: string)` callback.
- Produces: `ExploreGallery` with a selected scene and accessible next, previous, thumbnail, and select controls.

- [ ] **Step 1: Write the failing category-selection test**

```tsx
test('selects a business direction and opens research conditions', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '选择服装与表达' }));
  expect(screen.getByText('为服装与表达建立研究条件')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because the explorer has no selection callback.

- [ ] **Step 3: Implement the explorer and explicit image placeholders**

```tsx
export function ImagePlaceholder({ label }: { label: string }) {
  return <div className="image-placeholder" role="img" aria-label={label}><span>[{label}]</span></div>;
}
```

```tsx
<section aria-label={copy.exploreTitle} className="explore-stage">
  <ImagePlaceholder label="首页主视觉：代表当前品类氛围的高质量横向图" />
  <div className="scene-copy"><h1>{scene.title}</h1><p>{scene.description}</p></div>
  <button onClick={() => onSelectCategory(scene.id)}>{scene.selectLabel}</button>
</section>
```

Implement left and right buttons plus bottom thumbnail buttons. The rail must retain the current selection with `aria-current="true"`. Add keyboard handling for `ArrowLeft` and `ArrowRight` within the gallery container.

- [ ] **Step 4: Run the component behavior tests**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: PASS for selection, thumbnail navigation, and language switching.

- [ ] **Step 5: Commit the explorer**

```bash
git add src/components src/app/App.tsx src/app/App.test.tsx src/styles/app.css
git commit -m "feat: add horizontal business direction explorer"
```

## Task 4: Implement research conditions and staged research states

**Files:**
- Create: `src/components/ResearchForm.tsx`
- Create: `src/components/ResearchProgress.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `ResearchInput`, `Locale`, `onSubmit(input: ResearchInput)`, and `onBack()`.
- Produces: `ResearchProgress` statuses `loading | insufficient | error | complete` and `onComplete()`.

- [ ] **Step 1: Write the failing form workflow test**

```tsx
test('submits research conditions and shows staged research', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '选择服装与表达' }));
  await user.click(screen.getByRole('button', { name: '开始寻找商机' }));
  expect(screen.getByText('正在分析趋势')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because the research form and progress screen do not exist.

- [ ] **Step 3: Implement form validation and research progress**

Use Fluent UI `Input`, `Dropdown`, and `Button` controls. The form starts with the selected category and pre-fills `5000`, `中国人民币`, `美国`, and `TikTok Shop`. Disable submit until every field is present. The progress component cycles through these exact Chinese labels: `正在分析趋势`, `正在比对竞品`, `正在评估预算适配`, `正在整理证据`.

Provide buttons `返回修改条件` for insufficient data and `重新研究` for an error. Render an `ImagePlaceholder` whose label is `研究过程视觉：抽象数据采集、市场信号或网络节点动画，不得使用假图表冒充真实数据`.

- [ ] **Step 4: Run the tests and production build**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: exits with status 0.

- [ ] **Step 5: Commit the research flow**

```bash
git add src/components/ResearchForm.tsx src/components/ResearchProgress.tsx src/app/App.tsx src/app/App.test.tsx src/styles/app.css
git commit -m "feat: add research conditions and agent progress states"
```

## Task 5: Implement the opportunity carousel and evidence drawer

**Files:**
- Create: `src/components/OpportunityCarousel.tsx`
- Create: `src/components/EvidenceDrawer.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `Opportunity[]`, `Locale`, and `onOpenEvidence(opportunity: Opportunity)`.
- Produces: current candidate selection, candidate thumbnail rail, and `EvidenceDrawer` with evidence sections.

- [ ] **Step 1: Write the failing evidence drawer test**

```tsx
test('opens evidence in a drawer without leaving the current candidate', async () => {
  const user = userEvent.setup();
  render(<App initialScreen="opportunities" />);
  await user.click(screen.getByRole('button', { name: '查看数据依据' }));
  expect(screen.getByRole('dialog', { name: /数据依据/ })).toBeInTheDocument();
  expect(screen.getByText('示例来源')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL because the result screen has no evidence drawer.

- [ ] **Step 3: Implement the carousel and compact comparison rail**

Render one current opportunity as the visual primary view with an explicit placeholder label from `opportunity.visualPlaceholder`. Provide previous, next, and three candidate rail buttons. Each rail button shows the opportunity name, score, budget fit, and risk text. Do not use large filled score progress bars.

The main candidate view includes heading, score, reason list, budget fit, risk, and a `查看数据依据` button. The first mock item is initial selection, but the UI does not describe it as a guaranteed winner.

- [ ] **Step 4: Implement the drawer using Fluent UI**

```tsx
<Drawer type="overlay" open={open} onOpenChange={(_, data) => setOpen(data.open)}>
  <DrawerHeader><DrawerHeaderTitle>{title}</DrawerHeaderTitle></DrawerHeader>
  <DrawerBody>{evidence.map((item) => <EvidenceSection key={item.type} item={item} />)}</DrawerBody>
</Drawer>
```

Each `EvidenceSection` presents summary, metric, source name, collection time, coverage note when present, and a regular anchor with `target="_blank"` for the illustrative URL.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: PASS.

```bash
git add src/components/OpportunityCarousel.tsx src/components/EvidenceDrawer.tsx src/app/App.tsx src/app/App.test.tsx src/styles/app.css
git commit -m "feat: add opportunity comparison and evidence drawer"
```

## Task 6: Verify interaction completeness and visual quality

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: the completed prototype.
- Produces: documented run instructions and verified desktop demo behavior.

- [ ] **Step 1: Add missing state coverage tests**

```tsx
test('shows the insufficient-data recovery action', () => {
  render(<ResearchProgress status="insufficient" onComplete={() => {}} onBack={() => {}} />);
  expect(screen.getByRole('button', { name: '返回修改条件' })).toBeInTheDocument();
});

test('shows the error recovery action', () => {
  render(<ResearchProgress status="error" onComplete={() => {}} onBack={() => {}} />);
  expect(screen.getByRole('button', { name: '重新研究' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the full test suite and build**

Run: `npm run test -- --run`

Expected: every test passes.

Run: `npm run build`

Expected: exits with status 0 and creates `dist/`.

- [ ] **Step 3: Perform desktop visual verification at 1440px wide**

Run: `npm run dev -- --host 127.0.0.1`

Verify in a browser at 1440px width:

- the explorer fills one primary viewport and thumbnails remain visible;
- Chinese and English text both update from the top switch;
- all image slots show descriptive placeholders;
- research progress, no-data, and error paths are usable;
- three candidate directions can be selected and compared;
- the drawer opens, closes, and retains the selected candidate;
- contrast makes controls and text legible on the graphite background.

- [ ] **Step 4: Add run instructions and commit**

```md
# Venture Compass

## Run

`npm install`

`npm run dev`

## Test

`npm run test -- --run`
```

```bash
git add src/app/App.test.tsx README.md
git commit -m "test: verify venture compass demo states"
```

## Self-Review

- Spec coverage: Tasks 3 through 5 implement every page and interaction in the approved design. Task 4 contains all required research states. Task 6 verifies all required desktop behavior.
- Placeholder scan: the plan contains no unresolved implementation markers. Every task identifies exact files, interfaces, commands, and test behavior.
- Type consistency: `ResearchInput`, `Opportunity`, `EvidenceItem`, and `Locale` are defined in Task 2 and used with those exact names in later tasks.

## Task 7: Refine the photo-conveyor category rail

**Files:**
- Modify: `src/components/ExploreGallery.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: existing `categoryScenes`, locale, category selection callback, and keyboard navigation.
- Produces: a fixed center selection frame and a visually continuous, cyclic thumbnail conveyor without arrow controls.

- [x] **Step 1: Write failing behavior tests**

```tsx
test('renders no previous or next arrow controls in the photo rail', () => {
  render(<App />);
  expect(screen.queryByRole('button', { name: /previous|next|上一项|下一项/i })).not.toBeInTheDocument();
});

test('keeps one fixed center selection frame while cycling category thumbnails', async () => {
  const user = userEvent.setup();
  render(<App />);
  const frame = screen.getByTestId('fixed-selection-frame');
  await user.keyboard('{ArrowRight}');
  expect(frame).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /美妆个护/ })).toHaveAttribute('aria-current', 'true');
});
```

- [x] **Step 2: Implement a cloned cyclic thumbnail track**

Create a three-copy scene track. Center the selected scene from the middle copy under a separate `data-testid="fixed-selection-frame"` overlay. When navigation reaches either edge, reset to the equivalent middle-copy position after the movement transition so the user sees a continuous conveyor. Do not render arrow controls or pagination dots.

- [x] **Step 3: Apply the final visual system**

Make the rail approximately 10 percent of the viewport height. Use a single translucent dark rail surface. The fixed selected tile must have the teal outline and no blur. Every unselected tile receives a semi-transparent dark frosted overlay and blur. Reduce nonessential hero copy and the right information panel so the primary visual dominates.

- [x] **Step 4: Verify and commit**

Run: `npm run test -- --run`

Run: `npm run build`

```bash
git add src/components/ExploreGallery.tsx src/styles/app.css src/app/App.test.tsx docs/superpowers/specs/2026-08-23-venture-compass-design.md docs/superpowers/plans/2026-08-23-venture-compass-frontend.md
git commit -m "feat: refine photo conveyor category rail"
```

## Task 8: Add the digital-electronics video background

**Files:**
- Create: `src/assets/digital-electronics-background.mp4`
- Modify: `src/components/ExploreGallery.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/app/App.test.tsx`

- [x] Add the supplied 2560x1440 H.264 video as a project-local asset and use it only when the current category is `consumer-electronics`.
- [x] Render a muted, looped, inline video with `autoPlay`, `playsInline`, and `aria-hidden="true"`; place it behind an opaque enough graphite overlay to preserve readable content and a restrained product aesthetic.
- [x] Keep all other category visual placeholders unchanged. The video must not have controls or exposed audio, and its presentation remains neutral to consumer electronics.
- [x] Add a test that verifies the video is rendered only for the consumer-electronics category and has muted/loop/autoplay attributes.
- [x] Run `npm run test -- --run` and `npm run build`, then commit.
