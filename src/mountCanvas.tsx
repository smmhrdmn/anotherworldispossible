// Everything React- and tldraw-shaped lives behind this module, which is only
// ever reached through a dynamic import from main.ts. Importing React here
// rather than in the entry keeps the reading path free of it entirely.

import { StrictMode, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Tldraw } from 'tldraw'
import { useSyncDemo } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import { weekLabel } from '../shared/week.ts'

// Domain-bound and public by design: it ships in client JS and is inert
// anywhere but anotherworldispossible.xyz. Absent, tldraw runs in
// `unlicensed-production`; with the free hobby key it shows a watermark.
const LICENSE_KEY = import.meta.env.VITE_TLDRAW_LICENSE_KEY as string | undefined

/** tldraw's colour mode follows the sky, not the OS: paintTheme() already
 *  toggles `theme-dark` on <html>, so mirror that rather than introducing a
 *  second source of truth. */
function useSkyColorScheme(): 'dark' | 'light' {
  const read = () => (document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light')
  const [scheme, setScheme] = useState<'dark' | 'light'>(read)

  useEffect(() => {
    const obs = new MutationObserver(() => setScheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return scheme
}

function Board({ weekId }: { weekId: string }) {
  // PHASE 1 ONLY. useSyncDemo runs against tldraw's public demo server and
  // demo rooms expire daily — real multiplayer, but not durable. Phase 2
  // swaps this one hook for useSync({ uri, assets }) against our own Worker.
  const store = useSyncDemo({ roomId: `awip-${weekId}` })
  const colorScheme = useSkyColorScheme()

  // A third-party sync server that cannot be reached should not leave the
  // visitor staring at a spinner on what is otherwise a readable page.
  if (store.status === 'error') {
    return (
      <div className="canvas-error" role="alert">
        <p>This week’s canvas could not connect.</p>
        <button type="button" onClick={() => dispatchEvent(new CustomEvent('awip:set-mode', { detail: 'read' }))}>
          Read the page instead
        </button>
      </div>
    )
  }

  return (
    <div
      className="canvas-layer"
      role="application"
      aria-label={`${weekLabel(weekId)} — collaborative canvas`}
    >
      <Tldraw
        store={store}
        licenseKey={LICENSE_KEY}
        colorScheme={colorScheme}
        options={{ maxPages: 1 }}
      />
    </div>
  )
}

let root: Root | null = null

export function mount(host: HTMLElement, weekId: string) {
  root ??= createRoot(host)
  root.render(
    <StrictMode>
      <Board weekId={weekId} />
    </StrictMode>,
  )
}

export function unmount() {
  root?.unmount()
  root = null
}
