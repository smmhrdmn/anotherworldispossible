# 001 — Make late-arriving sentences enter gracefully

- **Status**: DONE
- **Commit**: b346cf1
- **Severity**: HIGH
- **Category**: Purpose & frequency / Missed transition (layout teleport)
- **Estimated scope**: 2 files (`index.html` script block, `styles.css`), ~40 lines

## Problem

The landing page reveals its sentences in one staggered cascade. A sentence
whose data fetch misses the 1200ms reveal window (`PER_FETCH_TIMEOUT_MS` in
`index.html`) is held at `display: none` and inserted later, when its data
arrives. The insertion is a layout **teleport**: the sentence snaps into the
paragraph flow, every line of text after it instantly shoves to a new
position, and only then does a 600ms opacity fade play on the new sentence.
The reflow shove is what reads as ungraceful — not the fade. The usual
straggler is the ISS sentence (two chained network calls: position, then
reverse-geocode), so this happens on most page loads.

```css
/* styles.css:585-588 — current */
.landing-sentence.is-pending {
  display: none;
  filter: none;
}

/* styles.css:622-626 — current */
.landing-sentence.is-shown {
  filter: none;
  opacity: 1;
  transition: opacity 600ms ease-out;
}
```

```js
// index.html, inside handleLateResolution(name) — current (abridged):
// el.classList.remove('is-pending');   // display:none -> inline (INSTANT reflow)
// void el.offsetWidth;                 // flush so the transition plays
// el.classList.add('is-shown');        // opacity 0 -> 1 over 600ms
```

```js
// index.html — current
const PER_FETCH_TIMEOUT_MS = 1200;
// ...
setTimeout(runPost, 3000); // safety net — caps total wait
```

## Target

Two independent changes; both are required.

**(a) Widen the reveal window so stragglers get rarer.** Change the
constants:

```js
const PER_FETCH_TIMEOUT_MS = 2000;
// ...
setTimeout(runPost, 3500); // safety net — caps total wait
```

The cascade's own stagger means users watch animation for the first ~2.5s
anyway; an extra 800ms of data budget costs nothing perceptible and lets most
loads (including many ISS resolutions) join the cascade normally.

**(b) Mask the insertion reflow with the page's existing blur language.**
When a late sentence enters, the whole affected paragraph takes a brief 2px
blur + slight opacity dip, the sentence is inserted mid-mask, and the
paragraph refocuses. The reflow then reads as a deliberate refocus rather
than a text shove.

```css
/* target — replace the .is-shown rule in styles.css */
.landing-sentence.is-shown {
  filter: none;
  opacity: 1;
  transition: opacity 450ms ease-out;
}

/* target — new rule, place directly after .is-shown */
.landing-text.is-resettling {
  filter: blur(2px);
  opacity: 0.6;
}

.landing-text {
  transition: filter 220ms ease-out, opacity 220ms ease-out;
}
```

```js
// target — handleLateResolution(name) restructured:
// 1. find the sentence el and its paragraph p = el.closest('.landing-text')
// 2. p.classList.add('is-resettling')
// 3. after 220ms (one transition length):
//      el.classList.remove('is-pending');          // reflow happens while blurred
//      resettlePunctuation();                      // existing call, keep it
//      void el.offsetWidth;
//      el.classList.add('is-shown');               // sentence fades in
//      p.classList.remove('is-resettling');        // paragraph refocuses
```

Use `setTimeout(..., 220)` for step 3 — matching the paragraph transition
duration exactly. If the paragraph was entirely hidden (`display: none`
because all of its sentences were pending — see the paragraph-display logic
in `fixTrailingPunctuation`), skip the mask (there is nothing visible to
blur) and just do the existing insert + fade.

## Repo conventions to follow

- All dynamic-content JS lives in the inline `<script>` IIFE in
  `index.html`; plain functions, defensive null checks (`if (!el) return;`).
  Imitate the existing `handleLateResolution` / `hideSentence` style.
- Blur-based reveals are this page's motion vocabulary — see
  `styles.css:573-600` (`.landing-sentence` starts at `filter: blur(8px)`,
  the cascade unblurs). The 2px mask deliberately quotes that language.
- Comments in this file explain *why*, not what — match that.

## Steps

1. `index.html`: change `PER_FETCH_TIMEOUT_MS` from `1200` to `2000`, and
   the safety-net `setTimeout(runPost, 3000)` to `3500`.
2. `styles.css`: change `.landing-sentence.is-shown` transition from
   `opacity 600ms ease-out` to `opacity 450ms ease-out`.
3. `styles.css`: add the `.landing-text` transition and
   `.landing-text.is-resettling` rules shown above, directly after the
   `.is-shown` rule (keep the explanatory comment style).
4. `index.html`: restructure `handleLateResolution` per the target sketch:
   paragraph mask on → 220ms → unhide + resettle + fade in + mask off.
   Preserve every existing behavior (pending-set removal, punctuation
   resettling, the `is-shown` fade) — only the sequencing and the mask are
   new.
5. Check `hideSentence`'s soft-exit path (`index.html`, the `is-hiding`
   branch): a late *failure* also reflows the paragraph when
   `display: none` lands after the 300ms fade. Apply the same paragraph
   mask there: mask on when the fade starts, remove `display` inside the
   mask window, mask off. Same 220ms constant.

## Boundaries

- Do NOT touch the on-time cascade (`.is-loaded`, `focusFade`, the stagger
  math) — if every fetch is fast, nothing about the page may change.
- Do NOT touch the fetch handlers themselves (weather/MTA/Mets/etc.).
- Do NOT add dependencies or move code out of the inline script.
- If `handleLateResolution` doesn't match the abridged sketch above (drift
  since commit b346cf1), STOP and report instead of improvising.

## Verification

- **Mechanical**: extract the inline script
  (`python3 -c "import re;h=open('index.html').read();open('/tmp/s.js','w').write(re.search(r'<script>(.*?)</script>',h,re.S).group(1))"`)
  and `node --check /tmp/s.js` → exits 0.
- **Feel check** (human, in a browser): DevTools → Network → throttle to
  "Slow 4G", reload. Confirm:
  - Stragglers' paragraphs soften (2px blur, slight dim) for ~a quarter
    second while the new sentence appears, then refocus — no hard text jump
    while fully sharp.
  - With no throttling, repeated reloads show the normal cascade with no
    paragraph blur flashes.
  - Block `api.wheretheiss.at` (DevTools request blocking) post-reveal: the
    ISS sentence fades out and the paragraph resettles under the same mask.
- **Done when**: node --check passes and the throttled-reload feel check
  shows no unmasked reflow jumps.
