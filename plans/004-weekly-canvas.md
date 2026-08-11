# 004 — anotherworldispossible.xyz as a weekly multiplayer canvas

- **Status**: PLANNED
- **Commit**: —
- **Severity**: — (user-requested feature, architectural)
- **Category**: New capability
- **Estimated scope**: repo-wide — adds a build step, a React app, and a Cloudflare Worker

## Problem

The site is a single hand-written `index.html` (962 lines, markup + an ~890-line IIFE) and
`styles.css` (1447 lines), served raw by GitHub Pages from `main`. Its signature is a page of
live-data sentences — weather, sunset, MTA, Mets, S&P, Wikipedia's most-read, the ISS, on-this-day
— under a palette that `computeTheme()` recomputes from NYC sun position and weather code,
enforcing WCAG AA contrast and crossfading over 1200ms (`index.html:313-405`).

The goal is to make it a FigJam-like space: **each week is a world.** The homepage becomes an
infinite tldraw canvas, seeded with that week's live data as shapes. Visitors see each other's
cursors and draw together. At the week boundary it freezes and joins a gallery of past weeks. The
site's name already carries the concept — every week, another world.

Four decisions are settled: **live multiplayer** (not a local sandbox), a **Vite build published by
GitHub Actions** (not CDN imports), **live data as the weekly seed**, and **the canvas as the
homepage**.

The through-line risk: the current site is excellent at exactly what a canvas is bad at — being
readable, accessible, fast, and indexable. This plan treats the canvas as an *enhancement layered
over* a real HTML document, never as a replacement for it.

## Verified against tldraw 5.3.0

`tldraw.dev` is blocked by the authoring environment's egress policy, so every claim below was
checked against the published npm tarballs (`.d.ts` and built JS), not the docs site. **Where
tldraw's own prose disagrees with its types, the types won.** Three findings contradict what the
documentation and docstrings say — see "Corrections" below.

- `tldraw`, `@tldraw/sync`, `@tldraw/sync-core`, `@tldraw/tlschema` all at **5.3.0**. Peer range is
  `react ^18.2.0 || ^19.2.1` — note React 19.0 and 19.1 are *excluded*. Pin exact versions.
- Client: `useSync({ uri, assets, users?, getUserPresence?, themes? })` returns a store for
  `<Tldraw store={store} />`. `uri` accepts an **async function**, re-invoked on every reconnect —
  this is what makes week rollover work transparently for connected clients.
- `assets` (a `TLAssetStore`) is required in production; without it uploads inline as base64.
- Server: `TLSocketRoom` from `@tldraw/sync-core` — `handleSocketConnect({ sessionId, socket,
  isReadonly? })` gives **per-session read-only**, `closeSession(id, reason)`, `getSessions()`,
  `getNumActiveSessions()`, `loadSnapshot()` (disconnects all clients).
- `TLSocketRoomOptions.authorizeRecord?: TLRecordAuthorizers` (d.ts:1321) — per-record-type hooks on
  create/update/delete that can veto *or rewrite* a record, with `session.sessionId` in scope.
- `SQLiteSyncStorage.hasBeenInitialized(sql): boolean` (static, d.ts:446) — the exact idempotency
  guard the weekly seeder needs.
- **`@tldraw/tlschema` is DOM-free and React-free** in its built output, and exports
  `createTLSchema` / `createShapeId`. Its deps (`state`, `store`, `utils`, `validate`) are all
  browser-agnostic, so schema work is possible inside a Worker.
- **Export is browser-only.** `getSvgString`, `getSvgElement`, and `toImage` hang off the `Editor`.
  There is no DOM-free render path in a Worker. This shapes the whole thumbnail design.
- **Licensing.** `LicenseManager` carries the states `unlicensed-production` and
  `licensed-with-watermark`, plus the string "License key is not valid for this domain." Keys are
  domain-bound. The free **hobby license** covers personal projects and renders a "made with
  tldraw" watermark.
  → **Request a hobby key for `anotherworldispossible.xyz` in Phase 0.** It is a human-in-the-loop
  step; do not let it land on the critical path in week five.

### Corrections (each verified in the shipped package)

1. **`PERMISSION_DENIED` is not a real close reason.** `TLSyncErrorCloseEventReason` (d.ts:1615-1634)
   is exactly `RATE_LIMITED`, `CLIENT_TOO_OLD`, `INVALID_RECORD`, `ROOM_FULL`, `NOT_FOUND`,
   `SERVER_TOO_OLD`, `UNKNOWN_ERROR`, `NOT_AUTHENTICATED`, `FORBIDDEN`. `PERMISSION_DENIED` appears
   *only* in a stale docstring example at d.ts:1212. Use **`FORBIDDEN`** to ban, **`RATE_LIMITED`**
   to throttle.
2. **`getCurrentSnapshot()` and `initialSnapshot` are both deprecated in 5.3.0** (d.ts:1089 and
   "@deprecated use the storage option instead"). The current freeze path is
   **`room.storage.getSnapshot()`**; the current seed path is
   **`new SQLiteSyncStorage({ sql, snapshot })`** passed as `TLSocketRoomOptions.storage`.
   `updateStore()` is likewise deprecated in favour of `storage.transaction()`. Writing against the
   deprecated surface means porting again within a couple of releases.
3. **`useSync` takes `users`, not `userInfo`.** The shipped `sync/DOCS.md` says `userInfo:` on 15
   lines; the `.d.ts` and `useSync.ts` both say `users?: TLUserStore`. Omit it entirely and you get
   `defaultUserStore` (localStorage-backed anonymous identity), which is right for a public board.

### Corrections to the repo's own CSS

`.work-item` (styles.css:229-293) is **not** a grid — it is a stacked list (`margin-bottom: 3rem`).
The real reusable infrastructure is:

- **`.page--single .grid` / `.card`** (styles.css:1055-1198) — a responsive grid with `view-grid` /
  `view-column` / `view-list` variants, a three-column `.view--portfolio` form (1370), and a
  single-column collapse at ≤1023px (1245). `.card img` already declares `aspect-ratio`,
  `object-fit: cover`, an 8px radius and a two-layer shadow. **It is already a thumbnail style.**
- **`.view-toggle` / `.view-toggle-thumb`** (styles.css:990-1053) — a finished two-state segmented
  control with an animated thumb, already reduced-motion-aware (1330). This is the **Board / Read**
  switch, already built.
- `.skip-link` (styles.css:144-158) — reuse for "Skip the canvas — read this page as text."

Two overrides will be needed: `.card--week img { aspect-ratio: 16/10 }` (the default `4/5` is a
portrait crop, wrong for a landscape board), and remapping the hardcoded `.card .context` `#767676`
and `.card p` `#1a1a1a` (1187-1197) onto `var(--text-muted)` / `var(--text)` — those predate the
token system and will not follow the sky.

## Target

### 1. Layout — Vite adopts the repo, the old page survives byte-identical

```
index.html                    NEW — canvas shell, Vite entry
package.json vite.config.ts tsconfig.json
src/
  main.tsx  Shell.tsx
  CanvasRoom.tsx              lazy chunk — the ONLY module importing tldraw
  Gallery.tsx  ArchiveWeek.tsx  Render.tsx
  theme/sky.ts                lifted from index.html:190-405
  theme/tldraw-bridge.css
  assets/assetStore.ts
shared/                       imported by BOTH src/ and worker/
  week.ts  liveData.ts
worker/
  wrangler.toml
  src/{worker,CanvasRoom,IndexRoom,assetUploads,bookmarkUnfurling,seed,rollover}.ts
  src/seed-template.json
public/                       served at / in dev AND build
  read.html                   ← git mv of today's index.html, zero diff
  styles.css  pix/  pdf/  CNAME
.github/workflows/{pages,thumbnail}.yml
```

Vite serves `publicDir` at `/` in both dev and build, so `read.html`'s `href="styles.css"` and
`src="pix/…"` resolve exactly as they do today — no `<base>` tag, no CI rewriting, no edits to the
962-line file. `CNAME` lands in `dist/` automatically.

The canvas shell **links** `/styles.css` rather than importing it, so there is one copy and no drift.

### 2. Worker and Durable Objects

Port the official `tldraw/tldraw-sync-cloudflare` template rather than inventing — its hibernation
handling is the fiddliest code in the stack and is already written.

| Route | Purpose |
|---|---|
| `GET /api/current` | `{weekId, roomId, startsAt, endsAt}`; also performs a lazy rollover check so a missed cron self-heals on first visit |
| `GET /api/archive` | Past weeks, for the gallery |
| `GET /connect/:roomId` | WebSocket upgrade → `env.CANVAS.idFromName(roomId)` |
| `POST/GET /uploads/:id` | R2 asset store |
| `GET /snapshot/:weekId` | Frozen `RoomSnapshot` JSON, `immutable` |
| `GET /thumb/:weekId.png` | R2 |
| `POST /admin/*` | Bearer-token gated |
| `scheduled()` | Hourly rollover check |

Two DO classes: `CanvasRoom` (one per week, `idFromName('week-2026-W33')`, SQLite-backed) and a
single `IndexRoom` holding the current-week pointer. **Use the index DO as the lock, not KV** — KV
is eventually consistent and two cron invocations could both read a stale pointer. KV/R2 hold only
read-optimized derived copies.

Room ids are `week-{ISOWeekYear}-W{ww}`. The ISO week-*year* is not the calendar year at the
December/January boundary — get this right in `shared/week.ts` or you create a duplicate room every
New Year.

### 3. Weekly rollover

**Run the cron hourly and no-op unless the week actually changed.** Cloudflare crons are UTC-only;
Monday 04:00 America/New_York is 08:00 UTC in EDT and 09:00 UTC in EST, so "04:00 local" is not
expressible in a UTC cron without breaking twice a year. Hourly + compare is DST-proof, idempotent
by construction, and self-healing.

`nyWeekId()` must derive NY civil time via `Intl.DateTimeFormat(…, {timeZone:'America/New_York'})
.formatToParts` — **never** `getTimezoneOffset()` arithmetic, which is wrong across DST. Subtract
4 hours before computing the ISO week, placing the boundary at Monday 04:00 local (a dead hour).

On a detected change, inside `IndexRoom` (single-writer, so these are serialized):
1. Freeze the outgoing room: if not already `frozen`, `room.storage.getSnapshot()` → R2
   `snapshots/{weekId}.json`, set `frozen`, then `closeSession()` each session **non-fatally** so
   clients reconnect, re-invoke the async `uri` fn, and land in the new week.
2. Seed the incoming room: `if (SQLiteSyncStorage.hasBeenInitialized(sql)) return`, else construct
   `SQLiteSyncStorage({ sql, snapshot })`.
3. Flip the pointer; write derived `current.json` / `archive.json` to R2; enqueue a thumbnail render.

Idempotency is layered: pointer compare in a single-writer DO, `hasBeenInitialized` before seeding,
a `frozen` flag before freezing, idempotent R2 `put` by key, and hourly retry absorbing any single
failure.

### 4. Seeding with live data as shapes

**Do not build records by hand, and do not run tldraw server-side.** The full `tldraw` package needs
React and DOM and will not run in workerd; but hand-writing `TLShape` records means hand-satisfying
schema validation, which breaks on every minor version.

**Third path — a committed template plus token substitution.** Lay the week's frame out by hand in
the real editor, export `editor.store.getStoreSnapshot()`, commit it as `seed-template.json` with
placeholders (`{{weather}}`, `{{mta}}`, `{{otd}}`, `{{weekLabel}}`…). At seed time the Worker
deep-clones, substitutes, and rewrites shape ids deterministically from the weekId. Zero schema
construction, zero validation risk, and the *design* happens where you can see it.

**The catch:** tldraw 5.x text shapes store `props.richText` as tiptap JSON, not a plain string.
Substitution must recurse the node tree replacing `text` leaves, not flat-`String.replace`. This is
the fiddliest part of Phase 4 — budget real time for it.

Stamp `meta: { seed: true }` on every seeded shape; §6 uses it to make them undeletable.

`shared/liveData.ts` lifts the seven fetch blocks out of `index.html` (weather :462 + `WMO` :167 +
`formatTime12` :180; MTA :541 + maps :544-600; Mets :585; S&P :642; Wikipedia Top 25 :725; ISS :760;
On This Day :845 + `cleanOtdText` :807) as pure fetch-and-parse functions returning *data*. Two thin
renderers sit on top: the existing DOM path (unchanged) and `toSeedTokens()`. Share the fetching,
never the DOM manipulation.

Server-side, CORS is irrelevant: hit `stooq.com` directly instead of the
`orange-bread-05b4.smmhrdmn.workers.dev` proxy, and drop `&origin=*` from the Wikipedia call.
Wrap everything in `Promise.allSettled` with a per-source timeout mirroring the existing
`PER_FETCH_TIMEOUT_MS = 2000` — **the cron must never fail to create a week because the MTA feed is
down.**

Also seed a **locked** cluster of the ~45 images in `pix/` (Recidiviz, PRX, Overton, Mythril…),
which are currently rendered nowhere. The original brief was "show my work"; this gives the
portfolio a home again and makes the canvas do double duty. Locking stops visitors dragging it into
the sea.

### 5. Gallery

**Archived weeks load as static snapshots, not read-only sync.** Even though per-session
`isReadonly` is verified and free, `GET /snapshot/:weekId` → `<Tldraw snapshot={json} />` with no
`store` prop gets an infinitely cacheable R2 object, no DO wake, no WebSocket, and a permalink that
works forever. Keep the readonly-*sync* path for the live week only, as the kill switch.

**Thumbnails render in a browser, on a schedule.** There is no server-side renderer. Add a
`/render?week=…` route that mounts `<Tldraw>` off-screen, waits for fonts, calls `editor.toImage(…)`
and POSTs the blob to `/admin/thumb/:weekId`; drive it from a Playwright GitHub Action weekly.
Phase 5 can drive it by hand. Cheap insurance: if a thumb is missing, synthesize a crude SVG poster
from the snapshot (one colored rect per shape) so the grid never has holes.

Markup reuses `.page--single .grid` + `.card`, inheriting the responsive collapse, radius, shadow
and `:active` scale for free.

### 6. Theme

This works out better than expected: tldraw's entire chrome is CSS-custom-property-driven
(`--tl-color-background`, `--tl-color-panel`, `--tl-color-text`, `--tl-color-selected`, … under
`.tl-theme__light` / `.tl-theme__dark`).

**Layer 1 — chrome, pure CSS, no JS bridge.** Remap those onto the existing tokens inside
`.tl-container`, with `--tl-color-background: transparent` so the body sky gradient shows through.
Because `--bg-top`, `--text`, `--text-muted`, `--accent` are `@property`-registered as `<color>`
(styles.css:20-28) with a 1200ms transition on `html` (49-56), **the tldraw toolbar crossfades with
the page for free.** This is the elegant part of the whole plan.

Caveats to check in-browser: `--widget-bg` and `--selection-bg` are *not* `@property`-registered and
will snap rather than fade; and `color-mix()` reading an animating registered property needs
verifying in Firefox specifically.

**Layer 2 — light/dark.** `paintTheme()` already toggles `.theme-dark` on `<html>`
(`index.html:374`). Lift `computeTheme`/`setThemeVars`/`paintTheme` into `src/theme/sky.ts` and pass
`colorScheme` to `<Tldraw>` on each paint. Hide tldraw's own dark-mode menu item — the sky decides.

Everything from the color math through `computeTheme()` (`index.html:197-355`) is **pure functions
over numbers**; only `setThemeVars()` touches the DOM. So the page, the canvas, and the Worker can
share one palette implementation — which lets the rollover seed each week's shapes in that week's
own sky colors. A frozen January week and a frozen July week then look different in the gallery, for
the right reason.

**Layer 3 — shape colors: don't.** `themes` exists and `useSync` registers custom colors before
store construction, but if you ever rename or remove one, **every archived snapshot using it fails
validation.** Leave the crayon palette alone in v1. Highest risk, smallest gain.

**Layer 4 — fonts.** Overriding `fonts.sans` to Atkinson Hyperlegible Next keeps the site's voice
on-canvas, but changes text metrics and reflows every existing text shape. **Do it once, before the
first public week, and never again.**

### 7. Moderation

- **Layer 0 — Cloudflare WAF**, zero code: rate-limit `/connect/*` (10 upgrades/min/IP) + Bot Fight
  Mode.
- **Layer 1 — connect gate**: per-IP counter; refuse at `getNumActiveSessions() > 40` with
  `ROOM_FULL`.
- **Layer 2 — `authorizeRecord`, the important one**: stamp `meta.sessionId` + `meta.createdAt` on
  every created shape (**do this from day one — provenance cannot be retrofitted**); reject deletes
  of `meta.seed === true`; reject absurdly-large bounds (the "one giant black rectangle" attack);
  budget creates per session per minute.
- **Layer 3 — escalation**: `closeSession(id, RATE_LIMITED)`; repeat offenders land on a denylist
  and thereafter connect `isReadonly: true` **silently**. Shadow-readonly beats an error dialog —
  no feedback loop to game.
- **Layer 4 — recovery**: checkpoint `storage.getSnapshot()` → R2 every 15 min, ~48 rolling, 30-day
  lifecycle. `POST /admin/restore/:weekId/:ts`, and `POST /admin/purge-session/:sessionId` deleting
  only shapes matching that `meta.sessionId`. **That last one is the moderation feature that
  matters** — vandalism removed without nuking everyone else's week. It works only because Layer 2
  stamped provenance.
- **Layer 5 — kill switch**: `readonlyOverride` in the room DO; plus a client backstop that renders
  text mode and **never loads the tldraw chunk** if `/api/current` fails.
- Owner identity: no accounts. `ADMIN_TOKEN` via `wrangler secret`, `/?admin=<token>` stashes it in
  localStorage.

### 8. Performance and accessibility

The site is ~85 KB today. tldraw realistically adds **1.0-1.4 MB gzipped JS plus ~90 KB CSS** —
estimated, not measured. Put `rollup-plugin-visualizer` in Phase 1 before committing to anything.

**The shell must be readable before tldraw loads and must never block on it.** The new root
`index.html` ships the same `<title>`/`og:` tags, the four landing paragraphs as **real static
HTML**, `/styles.css`, a ~2 KB inline bootstrap so the sky paints instantly, a `<noscript>` pointing
at `/read.html`, and the `.view-toggle` as a **Board / Read** switch. Then
`React.lazy(() => import('./CanvasRoom'))` behind an explicit affordance.

**Stay in text mode and don't even prefetch** when any of: `saveData`, `effectiveType` 2g/slow-2g,
`deviceMemory < 4`, `max-width: 1023px`, or `prefers-reduced-motion: reduce`. Mobile especially — a
canvas on a phone is bad *and* it is 1.3 MB of cell data. Default mobile to text plus this week's
thumbnail linking into the gallery. That is a better mobile experience, not a consolation prize.

**Reduced motion**: other people's cursors moving is motion you cannot opt out of, so don't autoload
the canvas at all under it. The existing block (styles.css:1295-1338) already handles the rest.

**Be honest about a11y**: tldraw's canvas is not meaningfully keyboard- or screen-reader-navigable
and no amount of ARIA changes that. State the contract instead — the canvas is an enhancement; the
text is the canonical, indexable, accessible version. Render each week's seeded sentences as a plain
text block beneath the canvas so the live data is readable without it.

### 9. Deploy, dev, secrets

`.github/workflows/pages.yml`: node 22 → `npm ci` → `npm run build` → assert `dist/CNAME` exists →
`upload-pages-artifact` → `deploy-pages` with `permissions: {pages: write, id-token: write}`.

Two things that will bite:
- **Settings → Pages → Source must be flipped from "Deploy from a branch" to "GitHub Actions" by
  hand.** Until then the workflow builds green and the site silently serves the old branch. This is
  the single most common way this migration appears to work and doesn't.
- `public/` is ~87 MB, so every run uploads 87 MB. It works, but turns an instant deploy into a
  1-2 minute one. That's the moment to move `pix/` into R2.

**Routing:** GitHub Pages has no SPA rewrite, so `/w/2026-W33` hard-404s on refresh — and archive
permalinks are the whole point. Use a **multi-page Vite build** (real files on disk) rather than the
`404.html` fallback, which serves every deep link as a soft 404.

**Dev:** `vite` :5173 + `wrangler dev --local --persist-to .wrangler/state` :8787, with
`server.proxy` mapping `/api`, `/connect` (`ws: true`), `/uploads`, `/snapshot`, `/thumb`.
`--persist-to` matters — without it the DO SQLite resets every restart and rollover is untestable.
Test the cron with `--test-scheduled`, plus a `?fakeNow=<iso>` param honored **only** when
`env.ENVIRONMENT === 'dev'`.

**Secrets:** the tldraw license key is public by design and domain-bound — inert if leaked;
committing it is not a security problem. `ADMIN_TOKEN` is a real secret (`wrangler secret put`).
Recommend **manual `wrangler deploy` through Phase 3** — the Worker changes far less often than the
site, and one fewer moving part while learning the stack is worth more than the automation.

**Cost:** the Workers **Free** plan can create SQLite-backed Durable Objects (the only kind it can
create) and free-plan users are not charged for SQLite storage. R2's free tier covers a year of
snapshots. What pushes this to the $5/mo paid plan is Browser Rendering (if used for thumbnails) or
sustained traffic. Confirm before Phase 2.

## Phasing

| Phase | Scope |
|---|---|
| **0** | Plumbing, zero visible change. `git mv index.html public/read.html`; move `styles.css`/`pix`/`pdf`/`CNAME` to `public/`; add Vite + workflow; flip the Pages source. **Request the hobby license now.** |
| **1** | Canvas, no backend — `useSyncDemo({roomId})` runs against tldraw's demo server. Settles the theme bridge, lazy-load gate, mobile fallback, license key, and **measures the bundle** with zero infrastructure. |
| **2** | Real Worker: port the template, R2 bucket, custom domain, swap `useSyncDemo` → `useSync`. One hardcoded room. |
| **3** | Weeks: `shared/week.ts`, `IndexRoom`, `/api/current`, hourly cron, freeze-to-R2. Test with `?fakeNow=` before trusting the cron. Soft-launch here, URL unshared. |
| **4** | Seeding: `shared/liveData.ts`, author `seed-template.json` in the live editor, token substitution. |
| **5** | Gallery: `/api/archive`, static-snapshot viewer, `.grid`/`.card` reuse, thumbnails by hand then automated. |
| **6** | Moderation: `authorizeRecord` budgets, checkpoints, `/admin/*`, WAF, purge-by-session. **Do not announce publicly before this lands.** |

## Verification

- **Multiplayer**: two browsers; draw in A → appears in B under 200ms with cursor and name. Go
  offline in A, draw, restore — nothing may be lost. Hard-reload both, confirm persistence.
- **Hibernation**: idle a tab 15+ minutes so the DO hibernates, then draw. **The single most likely
  thing to be quietly broken**, and it will not show up in any shorter test.
- **Rollover**: `curl "…/__scheduled?cron=0+*+*+*+*&fakeNow=…"`. Assert the pointer moved, the old
  snapshot is in R2, the old room is read-only, the new room has seed shapes — then **run it five
  more times and assert nothing changed.** Repeat with `fakeNow` inside the same week (clean no-op).
- **DST**: same test at 2026-11-01 and 2027-03-14; assert **exactly one** rollover across each
  transition, not zero and not two.
- **Gallery**: `/w/…` loads with **zero WebSocket connections** — check the Network panel; that is
  the actual assertion. Grid reflows to one column at 1023px.
- **Theme**: use the existing Theme Lab (`theme-lab.js`, localhost-only, `index.html:393-398`) to
  scrub hour 0→23; confirm the tldraw chrome crossfades in step and stays AA-legible at every hour.
  Chrome, Safari, **and Firefox** — the `@property` + `color-mix()` combination is the fragile bit.
- **Performance**: Lighthouse on `/` **without opening the canvas** should hold ≥95 at ~100 KB
  transferred. Treat that as the contract: if a change breaks it, the change is wrong.
- **Abuse**: script 500 creates in 10s; assert `RATE_LIMITED` fires. Then purge-by-session and
  assert *only* those shapes vanish.

## Risks, ranked

1. **The Pages source flip is manual** — not in code, not in review, and builds go green while the
   site serves the old branch.
2. **Cloudflare zone for the apex is unverified.** If the domain isn't on Cloudflare nameservers
   there is no `canvas.` subdomain and you're on `*.workers.dev`. Check *before* Phase 2 — it
   changes the URL and CORS story.
3. **The hobby license is a human-in-the-loop dependency** and renders a visible watermark. On a
   site this carefully art-directed, that may be the thing that kills the idea — look early.
4. **Bundle size is an estimate, not a measurement.** If 5.3.0 is materially worse than ~1.3 MB gz,
   the lazy-load gate stops being a nicety and becomes the entire design.
5. **DO hibernation + session resume is intricate template code, not yours.** Don't rewrite it.
6. **Schema drift is the long-lived liability** — `seed-template.json` and every archived snapshot
   are authored against 5.3.0. Mitigation: **write a PNG *and* an SVG at freeze time.** Those never
   rot, whatever happens to the JSON.
7. **Rich text**: text shapes carry tiptap JSON, not strings. Easy to underestimate.
8. **tldraw's shipped prose contradicts its shipped types** (three cases found). Trust the types;
   assume other docstrings are stale too.
9. **An empty board is sad.** A canvas nobody drew on all week reads as abandoned in a way a text
   page never does. The seed is what prevents that — over-invest in it.
10. **The site stops being a website.** Decision 4 accepts losing the plain-text default. But note
    what falls out of §8: mobile, slow connections, reduced-motion, no-JS and every crawler still
    get text, so a large share of visitors will never see the canvas. That is the correct outcome —
    which means text mode deserves to be designed as a first-class thing, not a degraded one.
