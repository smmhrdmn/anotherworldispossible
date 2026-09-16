// The entry. Deliberately vanilla and tiny: this runs for every visitor,
// including the ones who only want to read the page. React and tldraw are
// reached exclusively through the dynamic import in showBoard().

import { nyWeekId } from '../shared/week.ts'
import { canvasDefaultAllowed } from './capabilities.ts'
import './canvas.css'

type Mode = 'board' | 'read'
const STORAGE_KEY = 'awip:mode'

const host = document.getElementById('canvas-root')
const skipLink = document.querySelector<HTMLAnchorElement>('.skip-link')

if (host) {
  host.removeAttribute('aria-hidden')
  start(host)
}

function storedMode(): Mode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'board' || v === 'read' ? v : null
  } catch {
    return null // private mode, blocked storage
  }
}

function rememberMode(mode: Mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* non-fatal */
  }
}

function start(host: HTMLElement) {
  const weekId = nyWeekId()
  // The gate decides the *default*, never the ceiling: an explicit click
  // always gets the canvas.
  const mode: Mode = storedMode() ?? (canvasDefaultAllowed().allowed ? 'board' : 'read')

  const { setMode } = buildSwitch(host, weekId)
  setMode(mode, { remember: false })

  // In Board mode the document is display:none, so a plain anchor jump would
  // land nowhere. Make the skip link a real mode switch.
  skipLink?.addEventListener('click', (e) => {
    e.preventDefault()
    setMode('read')
    requestAnimationFrame(() => document.getElementById('landing')?.scrollIntoView())
  })
}

function buildSwitch(host: HTMLElement, weekId: string) {
  const bar = document.createElement('div')
  bar.className = 'canvas-switch view-toggle'
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', 'View')

  const thumb = document.createElement('span')
  thumb.className = 'view-toggle-thumb'
  thumb.setAttribute('aria-hidden', 'true')
  bar.appendChild(thumb)

  const buttons: Record<Mode, HTMLButtonElement> = {
    board: makeButton('Board'),
    read: makeButton('Read'),
  }
  bar.append(buttons.board, buttons.read)
  document.body.appendChild(bar)

  let current: Mode | null = null
  let loading = false

  function setMode(mode: Mode, opts: { remember?: boolean } = {}) {
    if (mode === current) return
    current = mode

    for (const key of ['board', 'read'] as const) {
      buttons[key].setAttribute('aria-pressed', String(key === mode))
    }
    placeThumb()

    document.documentElement.classList.toggle('canvas-active', mode === 'board')
    if (opts.remember !== false) rememberMode(mode)

    if (mode === 'board') showBoard()
    else hideBoard()
  }

  async function showBoard() {
    if (loading) return
    loading = true
    const note = document.createElement('div')
    note.className = 'canvas-loading'
    note.textContent = 'Loading this week’s canvas…'
    host.appendChild(note)

    try {
      const mod = await import('./mountCanvas.tsx')
      // The visitor may have switched back to Read while ~520kB was in flight.
      if (current === 'board') mod.mount(host, weekId)
    } catch (err) {
      console.error('[awip] canvas failed to load', err)
      note.textContent = 'The canvas could not load. The page below still works.'
      setMode('read')
      return
    } finally {
      loading = false
      note.remove()
    }
  }

  async function hideBoard() {
    if (!host.hasChildNodes()) return
    const mod = await import('./mountCanvas.tsx')
    mod.unmount()
  }

  // styles.css leaves .view-toggle-thumb at 0x0 for JS to size and place.
  function placeThumb() {
    const active = bar.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (!active) return
    thumb.style.width = `${active.offsetWidth}px`
    thumb.style.height = `${active.offsetHeight}px`
    thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
  }

  function makeButton(label: string) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.addEventListener('click', () => setMode(label.toLowerCase() as Mode))
    return b
  }

  addEventListener('resize', placeThumb)
  // The canvas can ask to hand control back (e.g. sync failed).
  addEventListener('awip:set-mode', (e) => {
    const next = (e as CustomEvent<string>).detail
    if (next === 'board' || next === 'read') setMode(next)
  })
  return { setMode }
}
