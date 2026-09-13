# Venture Compass research-flow integration

## Goal

Keep the approved opening animation and category-exploration home screen intact. Replace the current research placeholder with the clickable demo journey:

`Explore -> Conditions -> Researching -> Opportunities -> Evidence drawer`

## Experience contract

- The opening animation remains the first experience on every fresh load.
- The category rail, fixed selection frame, hero imagery, Chinese-default language switch, and current monochrome visual direction remain unchanged on the explore screen.
- Selecting a category carries that category into the conditions screen.
- The conditions form lets a user set category, budget, country, and platform. The demo defaults remain Clothing, 5000 USD, United States, and TikTok Shop.
- Submitting conditions runs a short staged analysis animation, then presents exactly three illustrative opportunity directions.
- Each direction can reveal an in-app evidence drawer with trend, competition, price, review, collection time, source links, and the selected research coverage.
- The UI must clearly call the recommendation and market evidence illustrative demo data until the backend is connected.
- Chinese and English must work on every stage.

## Integration approach

The target worktree already shares the same React/Vite data model, assets, copy, and home-screen components as the completed flow prototype. Integrate only the missing components and its screen state into the target `App`, while retaining the target worktree's `OpeningExperience` wrapper and its opening CSS.

## Verification

- Existing opening/home tests still pass.
- New flow tests cover category selection, valid condition submission, staged completion, the three-candidate result, evidence opening, and language switching.
- `npm test` and `npm run build` pass.
