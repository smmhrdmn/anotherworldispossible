// ISO week identity, anchored to New York local time.
//
// Cloudflare cron triggers are UTC-only, and America/New_York shifts with DST,
// so "Monday 04:00 local" is not expressible as a UTC cron. Instead the cron
// fires hourly and compares the id this module computes against a stored
// pointer. That makes rollover DST-proof and idempotent by construction.
//
// Shared verbatim by the client and the Worker so the two can never disagree.

const NY = 'America/New_York'
const DAY = 86_400_000

/** Wall-clock NY time, expressed as a UTC-based Date for arithmetic only. */
function nyCivil(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const v: Record<string, number> = {}
  for (const part of parts) if (part.type !== 'literal') v[part.type] = Number(part.value)
  // Some implementations report midnight as hour 24.
  if (v.hour === 24) v.hour = 0

  return new Date(Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second))
}

/** Monday-based weekday index: Mon=0 … Sun=6. */
function isoDay(d: Date): number {
  return (d.getUTCDay() + 6) % 7
}

/**
 * ISO-8601 week id for the week that `d` falls in, e.g. "2026-W38".
 *
 * Weeks roll at Monday 04:00 NY local — a dead hour, and late enough that a
 * Sunday-night visitor still lands in the week they think they're in.
 *
 * Note the ISO week-*year* is not always the calendar year: 2026-12-31 belongs
 * to 2027-W01. Getting this wrong creates a duplicate room every New Year.
 */
export function nyWeekId(d: Date = new Date()): string {
  const civil = nyCivil(d)
  civil.setUTCHours(civil.getUTCHours() - 4)

  // The ISO week-year is the year containing that week's Thursday.
  const thursday = new Date(civil)
  thursday.setUTCDate(civil.getUTCDate() - isoDay(civil) + 3)
  const isoYear = thursday.getUTCFullYear()

  // Week 1 is the week containing Jan 4.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const week1Thursday = new Date(jan4)
  week1Thursday.setUTCDate(jan4.getUTCDate() - isoDay(jan4) + 3)

  const week = Math.round((thursday.getTime() - week1Thursday.getTime()) / (7 * DAY)) + 1
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** Human label for a week id, e.g. "Week of September 14". */
export function weekLabel(weekId: string): string {
  const [yearStr, weekStr] = weekId.split('-W')
  const isoYear = Number(yearStr)
  const week = Number(weekStr)

  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - isoDay(jan4) + (week - 1) * 7)

  return `Week of ${new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'long', day: 'numeric',
  }).format(monday)}`
}
