# Plans

Each plan is self-contained. 001-003 came from the `improve-animations`
audit (commit b346cf1); full audit findings live in the conversation that
produced them.

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Graceful late-load](001-graceful-late-load.md) | HIGH | DONE |
| 002 | [Reduced-motion inversion](002-reduced-motion-inversion.md) | MEDIUM | DONE |
| 003 | [Cuelume sound cues](003-cuelume-sound-cues.md) | user-requested | DONE |
| 004 | [Weekly multiplayer canvas](004-weekly-canvas.md) | user-requested | PLANNED |

**Execution order**: 001 → 002 → 003.

**Dependencies**: 001 and 002 touch the same `.landing-sentence` CSS region
of `styles.css` — run 002 only after 001 so 002's reduced-motion overrides
account for 001's new `.is-resettling` paragraph mask (002's executor: if
001 has landed, also add `.landing-text { transition: none; }` inside the
reduced-motion block so the blur mask is dropped for reduced-motion users —
the late sentence then simply appears, which is correct). 003 is independent
of both but touches `index.html`, so run it last to avoid edit collisions.

Audit findings NOT planned (declined or deferred): view-toggle-thumb
width/height transition (portfolio view, low frequency), tooltip warm-state,
easing-token consolidation.

---

**004** is independent of 001-003 and much larger in scope: it introduces a
build step, a React app, and a Cloudflare Worker, and it moves `index.html`
to `public/read.html`. It is phased internally (Phase 0 is plumbing-only,
zero visible change) — read its Phasing table before starting. Because it
relocates `index.html` and `styles.css`, land any pending edits to those
files before Phase 0 rather than after.
