# 003 — Add Cuelume sound cues (whisper / tick / press)

- **Status**: DONE
- **Commit**: b346cf1
- **Severity**: — (user-requested feature, additive)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (`index.html`), ~30 lines

## Problem

The site has no audio feedback. The owner wants Cuelume
(https://cuelume-site.pages.dev/, npm package `cuelume`) — a library that
synthesizes interaction sounds live with Web Audio (no audio files) — wired
up as:

| Cue | Trigger |
| --- | --- |
| `whisper` | hover on **non-clickable** data pills (the `span.widget` elements and `.mta-bullet`s) |
| `tick` | hover on **links** (all `<a>`, including `.widget--link` pills and `.landing-cta-link`) |
| `press` | **clicking** a link |

## Target

A single `<script type="module">` added to `index.html` immediately before
the closing `</body>` tag (after the existing inline script), loading
cuelume from an ESM CDN and playing cues via delegated listeners:

```html
<script type="module">
  // Interaction sound cues (Cuelume, synthesized via Web Audio — no files).
  // Delegated so runtime-generated pills (weather, Mets, ISS…) are covered
  // without touching the widget() factory.
  import { play } from 'https://esm.sh/cuelume';

  // Hover cues only make sense (and only fire reliably) on real pointers.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let lastHovered = null;
    document.addEventListener('mouseover', (e) => {
      const link = e.target.closest('a');
      const pill = link ? null : e.target.closest('.widget, .mta-bullet');
      const hit = link || pill;
      if (!hit || hit === lastHovered) return;
      lastHovered = hit;
      play(link ? 'tick' : 'whisper');
    });
    document.addEventListener('mouseout', (e) => {
      if (lastHovered && !lastHovered.contains(e.relatedTarget)) lastHovered = null;
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a')) play('press');
  });
</script>
```

## Executor MUST verify the API before writing code

The exact cuelume API surface (does `play()` exist at top level? does it
need `init()`/`bind()` first? is there a volume option?) must be confirmed
against the real package, not assumed:

1. `curl -s https://esm.sh/cuelume | head -50` — confirm the module resolves
   (an error page or 404 means try `https://unpkg.com/cuelume?module` or
   `https://cdn.jsdelivr.net/npm/cuelume/+esm`).
2. `curl -s https://cdn.jsdelivr.net/npm/cuelume/package.json` — check the
   real entry points and exports.
3. If the exports differ from `{ play }` (e.g. a default export, or cues
   exposed as functions like `whisper()`), adapt the snippet to the real
   API, keeping the trigger logic identical.
4. If a global volume/gain option exists, set it low (≈0.5 of default or
   the library's "subtle" preset if any) — these are ambient cues, not
   notifications.

Known platform constraint to preserve, not fight: browsers block Web Audio
until the first user gesture — the first hover may be silent. Cuelume
likely resumes its AudioContext on first interaction; do not add any
auto-resume hacks beyond what the library does itself.

## Repo conventions to follow

- `index.html` is a hand-written static file; keep the new script small,
  commented with *why*, and place it after the existing inline `<script>`.
- The existing script uses defensive feature checks — the
  `matchMedia('(hover: hover)…')` gate follows that spirit and mirrors the
  CSS `@media (hover: none)` gate used for tooltips (`styles.css`, the
  `[data-source]` block).

## Steps

1. Verify the CDN module + API per the section above.
2. Add the `<script type="module">` block to `index.html` before
   `</body>`, adapted to the verified API.
3. If (and only if) the delegated-listener approach conflicts with how the
   library wants to bind (e.g. it only works via `data-cuelume-*`
   attributes + `bind()`), fall back to: `bind()` once, add static
   attributes to the three `.landing-cta-link`s and the two `.widget--link`
   anchors in the markup, and add the attribute in the `widget()` and
   `mtaBullet()` factory functions in the existing inline script. Prefer
   the delegated approach.

## Boundaries

- Do NOT touch `styles.css`.
- Do NOT modify the existing inline script unless step 3's fallback is
  genuinely required.
- Do NOT add npm/package.json/build tooling — CDN module only.
- Do NOT preload or autoplay audio; no sounds before a user gesture.
- If the cuelume package cannot be resolved from any of the three CDNs,
  STOP and report — do not vendor code by hand-copying from the site.

## Verification

- **Mechanical**: `curl -s -o /dev/null -w '%{http_code}' <chosen CDN URL>`
  → 200. Extract and `node --check` the EXISTING inline script (must be
  untouched unless fallback used). `grep -c 'type="module"' index.html` → 1.
- **Feel check** (human, sound on): hover a data pill → whisper; hover a
  link → tick; click a link → press. Sweeping across the Mets sentence
  should not machine-gun — each pill fires once per entry. Tab-focusing
  links fires nothing (hover-only by design). First-ever hover may be
  silent (autoplay policy) — expected.
- **Done when**: CDN resolves, listeners fire the right cue per target, no
  console errors on load.
