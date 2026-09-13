# Country Globe Selector Design

## Goal

Replace the research-conditions page's ordinary target-country text field with a desktop-first, draggable 3D globe and a synchronized country input. The globe makes country selection tangible while retaining keyboard-friendly text entry.

## Scope

- Add a `react-globe.gl` WebGL globe to the research-conditions screen only.
- The globe uses a white surface, pale-gray geographic boundaries and graticules, muted borders, and red interactive market markers. It follows the information-design language in the provided reference video rather than a blue sci-fi globe.
- It displays exactly eight clickable country markers: United States, United Kingdom, Germany, France, Japan, South Korea, Brazil, and United Arab Emirates.
- The globe can be rotated by mouse or trackpad drag. It slowly auto-rotates only while idle; direct user interaction pauses it.
- Clicking a marker writes that country into `ResearchInput.country`, focuses the selected point visually, and synchronizes the adjacent input.
- Entering one of the eight supported countries into the input rotates the globe to its marker and highlights it. Any other non-empty country remains valid form input, but has no marker or automatic globe target.
- Country names are localized for display in Chinese and English; the persisted `ResearchInput.country` remains a stable English country name.
- The existing category, budget, currency, platform, validation, back action, and submit action remain available and unchanged in purpose.
- The starting demo country is United States / 美国.

## Components and data

### `src/app/marketCountries.ts`

Export a typed array of eight `MarketCountry` values:

```ts
export type MarketCountry = {
  id: 'United States' | 'United Kingdom' | 'Germany' | 'France' | 'Japan' | 'South Korea' | 'Brazil' | 'United Arab Emirates';
  coordinates: { lat: number; lng: number };
  label: Record<Locale, string>;
};
```

The coordinates drive both the marker location and the camera target.

### `src/components/CountryGlobe.tsx`

Receives `locale`, the current stable country name, the eight `MarketCountry` values, and `onSelect(country: string)`. It owns only globe rendering, drag/idle rotation behavior, marker selection, and programmatic camera movement. It never owns form state.

It exposes accessible marker controls outside the canvas in an SR-only list so all eight destinations remain keyboard operable. The canvas has a concise instruction label telling users to drag to rotate and use the country input or marker list to select a market.

### `ResearchForm`

Owns the `draft: ResearchInput` state. It passes `draft.country` to both the new globe and country input and updates the same state for either interaction. The text input retains a normal visible label and an accessible datalist of the eight localized market names.

## Interaction and visual behavior

- The left content column contains an approximately square globe panel and a small uppercase caption: “全球市场 / Global markets”.
- The right column contains the research copy and fields. At desktop width, the globe remains adjacent to the form instead of pushing the form below it.
- Red point: clickable market marker. Selected point enlarges slightly and gains a restrained red halo.
- Hover: a compact label with localized country name.
- The marker list is visually hidden but announced to assistive technology; it mirrors the same eight points.
- Text matching accepts either locale's display name and normalizes it to the stable English `MarketCountry.id` where it exactly matches. Free text is preserved as entered.
- Autocomplete suggestions list all eight markets and select via mouse or keyboard without requiring a globe click.

## Dependencies and performance

- Add `react-globe.gl`, `three`, and geographic land data (`world-atlas`) only as production dependencies required for the globe.
- Lazy-load the globe component with a compact fallback so the existing opening animation and hero page do not wait on 3D dependencies.
- Respect `prefers-reduced-motion`: no automatic rotation, while manual drag and selection remain available.
- If WebGL initialization fails, keep the input and marker list usable and show a concise “地图不可用，仍可输入国家” fallback message.

## Localization and truthfulness

- Add all visible Chinese and English labels, country names, input guidance, fallback text, and interaction instructions to `copy.ts`.
- The globe is a country selector, not evidence of live demand. Do not render data scores, market claims, or fake dynamic signals on it.

## Verification

- Unit-test country normalization and marker data coverage.
- Component-test selecting a marker, text entry of a supported country, free-text preservation, and reduced-motion configuration.
- Integration-test that globe selection changes the country form field, and submitting continues into the existing illustrative research flow with the selected country.
- Retain the existing opening, image-first explore screen, fixed category rail, language switch, full test suite, and production build contracts.
