# 002 — Fix inverted reduced-motion handling

- **Status**: DONE
- **Commit**: b346cf1
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`styles.css`), ~25 lines

## Problem

The site's only reduced-motion rule kills every CSS *transition* but leaves
every *keyframe animation* running:

```css
/* styles.css:1281-1284 — current */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
```

The result is exactly backwards. Under `prefers-reduced-motion: reduce`:

- The big movements still play at full strength: the 1200ms `focusFade`
  blur cascade on every landing sentence (`styles.css:590-600`), the
  `fadeIn` keyframes with `translateY(12px)` on page sections
  (`styles.css:70-118`), and the CTA-link `focusFade` (`styles.css:760`).
- The gentle, comprehension-aiding feedback dies: hover color fades, the
  tooltip fade, the late-sentence opacity fade (stragglers snap in), the
  soft-exit fade (sentences pop out), and the theme-gradient crossfade
  (`styles.css:51-56`) all become instant.

Reduced motion should mean *fewer and gentler* animations — drop movement
and large effects, keep short opacity/color feedback — not zero transitions
plus full-strength movement.

## Target

Replace the block at `styles.css:1281-1284` with:

```css
@media (prefers-reduced-motion: reduce) {
  /* Drop movement and blur, keep brief opacity/color feedback. */
  .page > *,
  main > *,
  .work-item,
  .other-item,
  .sidebar-info {
    animation: fadeOnly 200ms ease-out forwards;
    animation-delay: 0s;
  }

  .landing-sentence,
  .landing-cta-link {
    filter: none;
  }

  .landing-sentence.is-loaded,
  .landing-cta-link.is-loaded {
    animation: fadeOnly 200ms ease-out forwards;
    animation-delay: 0s;
  }

  /* Movement and long theme crossfades snap; short feedback remains. */
  html {
    transition: none;
  }

  .view-toggle-thumb,
  .weather-popover,
  .section-caret {
    transition: none;
  }

  *:active {
    transform: none !important;
  }
}
```

Notes on the values:

- `fadeOnly` already exists (`styles.css:602-604`: `@keyframes fadeOnly { to { opacity: 1; } }`) — reuse it, do not define a new keyframe.
- `animation-delay: 0s` deliberately removes the staggers — a cascade is
  choreographed movement even when each step is a fade; reduced motion gets
  one quick simultaneous fade.
- The `fadeIn` keyframes' `translateY(12px)` is movement — the `fadeOnly`
  override removes it while preserving the fade so content still appears
  gently rather than popping.
- `transform: none !important` on `:active` removes press-scale movement
  (`.landing-cta-link:active` at `styles.css:756-758`, `.view-toggle
  button:active`, card/image presses) while `a:active { opacity: 0.7 }`
  keeps non-motion press feedback.
- Everything not listed keeps its normal transitions — they are all short
  (120–450ms) opacity/color fades, which reduced motion should keep.

## Repo conventions to follow

- Media-query overrides in this file restate full declarations rather than
  using custom properties — see the mobile override at `styles.css:606-616`
  for the pattern (`.landing-sentence.is-loaded { animation: fadeOnly 750ms
  ease-out forwards; }`). Imitate it.
- Keep the block at the same position in the file (after the mobile media
  queries, near the end).

## Steps

1. `styles.css`: delete the `* { transition: none !important; }` block at
   `styles.css:1281-1284` and insert the target block above in its place,
   preserving the `@media (prefers-reduced-motion: reduce)` wrapper.

## Boundaries

- Do NOT touch anything outside the single `@media (prefers-reduced-motion:
  reduce)` block.
- Do NOT rename or redefine existing keyframes.
- If line numbers have drifted from commit b346cf1, locate the block by its
  content (`prefers-reduced-motion`) — if its content differs from the
  "current" excerpt above, STOP and report.

## Verification

- **Mechanical**: `grep -c 'prefers-reduced-motion' styles.css` → 1;
  CSS still parses (load the page, DevTools console shows no CSS errors;
  or `python3 -c "import tinycss2"`-style checks are NOT required — a
  browser load suffices).
- **Feel check** (human): DevTools → Rendering → "Emulate CSS
  prefers-reduced-motion: reduce", reload the landing page. Confirm:
  - Sentences fade in quickly all at once — no blur, no stagger, no slide.
  - Hovering a link still fades its color; hovering a pill still fades the
    tooltip in.
  - Pressing a CTA link does not scale, but still dims.
  - Turning the emulation off restores the full cascade exactly as before.
- **Done when**: both emulation states behave as described.
