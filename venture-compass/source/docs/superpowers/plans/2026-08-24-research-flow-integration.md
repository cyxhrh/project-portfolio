# Research Flow Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the working conditions, analysis, results, and evidence journey to the approved opening-animation version without changing its explore-screen experience.

**Architecture:** Keep `OpeningExperience` as an outer gate around the application shell. Replace the target placeholder branch with a typed screen state machine. New page components receive explicit props, while the existing gallery and its assets remain unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Fluent UI Drawer.

**Spec:** `docs/superpowers/specs/2026-08-24-research-flow-integration.md`

## Global Constraints

- Keep the target opening animation, opening CSS, hero images, bottom category rail, fixed center selection frame, and monochrome explore styling unchanged.
- Use the existing nine category assets and default demo: apparel/shoes/bags, USD 5000, United States, TikTok Shop.
- Mark all recommendations, metrics, collection records, and links as illustrative non-live demo data.
- Chinese is the default; all new screen copy supports Chinese and English.
- Desktop layout only; preserve `min-width: 1440px`.

---

### Task 1: Define screen state and conditions form

**Files:**
- Create: `src/components/ResearchForm.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/copy.ts`
- Modify: `src/styles/app.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- `Screen = 'explore' | 'conditions' | 'researching' | 'opportunities'`.
- `ResearchFormProps = { locale: Locale; scenes: CategoryScene[]; value: ResearchInput; onSubmit(value: ResearchInput): void; onBack(): void }`.

- [ ] **Step 1: Write the failing selection and form test**

```tsx
await user.click(screen.getByRole('button', { name: '选择服装鞋包' }));
expect(screen.getByRole('heading', { name: '为服装鞋包建立研究条件' })).toBeInTheDocument();
expect(screen.getByLabelText('预算')).toHaveValue(5000);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/app/App.test.tsx -t "selects a business direction"`

Expected: FAIL because the old branch has no form control.

- [ ] **Step 3: Implement the smallest working form and transition**

```tsx
type Screen = 'explore' | 'conditions' | 'researching' | 'opportunities';
const [screen, setScreen] = useState<Screen>('explore');
const [researchInput, setResearchInput] = useState<ResearchInput>(demoResearchInput);
const selectCategory = (categoryId: string) => {
  setResearchInput((current) => ({ ...current, categoryId }));
  setScreen('conditions');
};
```

Render category, budget, country, and platform in `ResearchForm`. Its submit handler calls `onSubmit(draft)` only if all values are valid; its back button calls `onBack`. Add both Chinese and English labels.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/app/App.test.tsx -t "selects a business direction"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResearchForm.tsx src/app/App.tsx src/app/copy.ts src/styles/app.css src/app/App.test.tsx
git commit -m "feat: add research conditions form"
```

### Task 2: Add staged illustrative analysis

**Files:**
- Create: `src/components/ResearchProgress.tsx`
- Create: `src/components/ResearchProgress.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- `ResearchProgressProps = { locale: Locale; status: 'loading' | 'insufficient' | 'error'; category: CategoryScene; researchInput: ResearchInput; onComplete(): void; onBack(): void; onRetry(): void }`.
- `onComplete()` fires after trend, competition, budget, and evidence stages at 800 ms intervals.

- [ ] **Step 1: Write the failing fake-timer test**

```tsx
vi.useFakeTimers();
render(<ResearchProgress {...props} />);
expect(screen.getByText('演示步骤：分析趋势')).toBeInTheDocument();
vi.advanceTimersByTime(3200);
expect(props.onComplete).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- src/components/ResearchProgress.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement progress and recovery states**

```tsx
const progressStages = ['trend', 'competition', 'budget', 'evidence'] as const;
const timers = progressStages.map((_, index) => window.setTimeout(
  index === progressStages.length - 1 ? onComplete : () => setStageIndex(index + 1),
  (index + 1) * 800,
));
```

Clear timers in the effect cleanup. Render the selected image with a graphite scrim, readable current stage, and `onBack`/`onRetry` actions for non-loading status.

- [ ] **Step 4: Run component and flow tests**

Run: `npm test -- src/components/ResearchProgress.test.tsx src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResearchProgress.tsx src/components/ResearchProgress.test.tsx src/app/App.tsx src/styles/app.css
git commit -m "feat: add staged research analysis"
```

### Task 3: Add three opportunities and evidence

**Files:**
- Create: `src/components/OpportunityCarousel.tsx`
- Create: `src/components/EvidenceDrawer.tsx`
- Modify: `src/app/mockData.ts`
- Modify: `src/app/copy.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`
- Modify: `vite.config.ts`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- `getDemoOpportunities(categoryId: string, locale: Locale): Opportunity[]` returns localized illustrative candidates.
- `OpportunityCarousel` renders `opportunities.slice(0, 3)` and calls `onEditConditions(): void`.
- `EvidenceDrawerProps = { locale: Locale; category: CategoryScene; opportunity: Opportunity; researchInput: ResearchInput; open: boolean; onOpenChange(open: boolean): void }`.

- [ ] **Step 1: Write failing results and evidence assertions**

```tsx
expect(screen.getAllByRole('button', { name: /候选商品方向/ })).toHaveLength(3);
await user.click(screen.getByRole('button', { name: '查看数据依据' }));
expect(screen.getByRole('dialog', { name: '数据依据' })).toBeInTheDocument();
expect(screen.getByText('示例指标，非实时数据')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/app/App.test.tsx -t "shows three illustrative opportunities"`

Expected: FAIL because there are no result or evidence controls.

- [ ] **Step 3: Implement localized opportunities and the drawer**

```tsx
const candidates = opportunities.slice(0, 3);
const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? '');
<Drawer type="overlay" position="end" size="medium" open={open} onOpenChange={(_, data) => onOpenChange(data.open)} />
```

Include illustrative trend, competition, price, reviews, collection time, source link, and selected category/budget/country/platform coverage. Scope Vite test aliases for Fluent UI only under test configuration.

- [ ] **Step 4: Run results, English, and evidence tests**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS with Chinese/English results, exactly three candidates, and a working drawer.

- [ ] **Step 5: Commit**

```bash
git add src/components/OpportunityCarousel.tsx src/components/EvidenceDrawer.tsx src/app/mockData.ts src/app/copy.ts src/app/App.tsx src/styles/app.css vite.config.ts src/app/App.test.tsx
git commit -m "feat: add opportunity results and evidence"
```

### Task 4: Verify the preserved baseline

**Files:**
- Modify: `src/app/App.test.tsx`
- Modify: `src/styles/heroVisualContract.test.tsx`

**Interfaces:**
- The initial render still exposes `OpeningExperience`.
- After skipping it, `ExploreGallery` still exposes `fixed-selection-frame` and no previous/next controls.
- Home and form-back return to `explore`.

- [ ] **Step 1: Write opening and rail regression coverage**

```tsx
render(<App />);
fireEvent.pointerDown(screen.getByRole('button', { name: '跳过开场并进入商机罗盘' }));
expect(screen.getByTestId('fixed-selection-frame')).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /上一个方向|下一个方向/ })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 3: Make only a minimal correction if this fails**

Keep `OpeningExperience` outside the shell, leave all `.explore-*` selectors untouched, and make `onHome` call `setScreen('explore')`.

- [ ] **Step 4: Verify test and production builds**

Run: `npm test -- --run && npm run build`

Expected: all tests pass and Vite emits the production build.

- [ ] **Step 5: Commit final verification corrections if any were required**

```bash
git add src/app/App.tsx src/app/App.test.tsx src/styles/heroVisualContract.test.tsx
git commit -m "test: verify opening and research flow integration"
```

## Self-review

- The four tasks cover every spec requirement: preserved opening/home, conditions, analysis, three recommendations, evidence, illustrative labeling, localization, and verification.
- The plan contains no placeholders and uses the same `Screen`, prop, and data names throughout.
