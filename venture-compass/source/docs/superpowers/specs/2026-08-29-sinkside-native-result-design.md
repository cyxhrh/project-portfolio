# Venture Compass → SINKSIDE Native Result Design

> Superseded on 2026-08-29 by direct UI feedback. The approved implementation keeps SINKSIDE as a separate bundled page at `/sinkside/index.html`: entering a non-empty idea turns the CTA into a direct link to that page. The original proposal below is retained as decision history and is not the current implementation contract.

## Goal

Turn the current Venture Compass idea-entry demo into one continuous competition story:

1. The visitor enters a business idea and chooses the United States on the globe.
2. Venture Compass shows a short staged research sequence.
3. The interface resolves into the complete SINKSIDE under-sink organizer campaign as the generated product direction.

The local preview remains `http://127.0.0.1:5179/`. The SINKSIDE result is rendered natively inside the React application; it is not an iframe and does not navigate to the separately deployed campaign URL.

## Experience Flow

The application owns a small screen state machine:

- `idea`: the existing opening experience and idea-first globe form.
- `researching`: a concise Venture Compass analysis transition using the existing research-progress visual language.
- `sinkside`: the full SINKSIDE campaign page.

Submitting a non-empty idea moves from `idea` to `researching`. The research sequence advances automatically and then reveals `sinkside`. The product page opens at its top, fills the viewport, and uses the existing SINKSIDE hero video, imagery, English copy, pricing interaction, and in-page navigation.

A restrained “Back to Venture Compass” action is available in the campaign header so the presenter can restart the demo without reloading the browser. Returning resets the submitted state but may preserve the selected market.

## Product Result

The native result preserves the approved SINKSIDE direction:

- full-viewport campaign-video hero;
- light neutral, editorial furniture-brand styling;
- English consumer-facing copy for the United States;
- three product-use scenes;
- before/after cabinet comparison;
- renter and homeowner price-point interaction;
- product still life and closing call to action.

The result must feel like a generated commercial destination, not a Venture Compass dashboard panel. Venture Compass chrome therefore recedes while the campaign is visible. Only the subtle return action connects the two experiences.

## Component Boundaries

- `App` owns the three-screen state and transition callbacks.
- `ResearchForm` emits the submitted idea and selected country instead of only showing local feedback.
- `ResearchProgress` remains responsible for staged progress and completion timing.
- A new `SinksideCampaign` component owns the product-page markup and pricing state.
- A dedicated SINKSIDE stylesheet scopes the campaign visual system so it cannot change the existing opening/globe styles.
- SINKSIDE media assets are copied into a dedicated app asset folder and imported locally so the demo has no dependency on the deployed website or network availability.

## Data and Interaction

The competition demo intentionally maps every valid submitted idea to the prepared SINKSIDE result. The research screen frames it as an illustrative validation output rather than live market research.

The two SINKSIDE product tiers remain:

- Rental-ready — `$25`, no drilling and easy to move.
- Built to last — `$69`, sturdier finish for a long-term home.

Selecting a tier updates the adjacent product summary. In-page navigation scrolls to campaign sections. The closing call to action returns to the tier selector rather than leaving the application.

## Accessibility and Responsive Behavior

- All screen changes expose a single clear level-one heading.
- The research transition includes a polite status announcement.
- Campaign video remains muted, looping, and inline, with reduced-motion users receiving a stable visual experience.
- Buttons and links remain keyboard reachable with visible focus treatment.
- The campaign supports the existing desktop competition viewport and collapses to a readable one-column mobile layout without horizontal overflow.

## Validation

Automated tests will verify:

1. a non-empty idea submission opens the research screen;
2. the completed research sequence reveals the SINKSIDE campaign;
3. the campaign contains the approved English hero and local video source;
4. choosing either product tier updates price and promise text;
5. “Back to Venture Compass” restores the idea-entry screen;
6. existing opening, globe-selection, and localization tests still pass.

The final acceptance run includes the full test suite, a production build, and a browser check at `http://127.0.0.1:5179/` covering the complete interaction path.

## Out of Scope

- Live AI research, marketplace scraping, checkout, inventory, payment, and account systems.
- Loading the public SINKSIDE deployment in an iframe.
- Reworking the approved Venture Compass opening animation or globe visual design.
- Republishing the standalone SINKSIDE website as part of this integration task.
