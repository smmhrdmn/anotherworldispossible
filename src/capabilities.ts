// Whether this device should get the canvas *by default*.
//
// tldraw is ~1MB+ of JS on a site that is otherwise ~85KB, and the landing
// page is the canonical, readable version of this site. So the canvas is
// opt-out on capable desktops and opt-in everywhere else. A visitor who
// explicitly asks for Board mode always gets it — this gate only decides the
// default, never the ceiling.

export type CanvasGate = { allowed: boolean; reason: string }

export function canvasDefaultAllowed(): CanvasGate {
  if (typeof window === 'undefined') return { allowed: false, reason: 'no-window' }

  const mm = window.matchMedia?.bind(window)
  // Other people's cursors are motion you cannot opt out of once mounted.
  if (mm?.('(prefers-reduced-motion: reduce)').matches) {
    return { allowed: false, reason: 'prefers-reduced-motion' }
  }
  // Matches the existing breakpoint in styles.css.
  if (mm?.('(max-width: 1023px)').matches) {
    return { allowed: false, reason: 'small-screen' }
  }

  const conn = (navigator as any).connection
  if (conn?.saveData) return { allowed: false, reason: 'save-data' }
  if (typeof conn?.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) {
    return { allowed: false, reason: 'slow-network' }
  }

  const memory = (navigator as any).deviceMemory
  if (typeof memory === 'number' && memory < 4) {
    return { allowed: false, reason: 'low-memory' }
  }

  return { allowed: true, reason: 'ok' }
}
