// Date ranges for the dashboard. Dates are "YYYY-MM-DD" calendar days, both ends inclusive, as
// the analytics API takes them (docs/api.md). They're built from the browser's local date, which
// for UNC admins is the API's America/New_York.

export const PRESETS = [7, 30, 90] as const
export type Preset = (typeof PRESETS)[number]

// The API's own default when no range is given.
export const DEFAULT_PRESET: Preset = 30

export function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// "YYYY-MM-DD" as a local date (new Date("2026-11-03") would be midnight UTC, the day before here).
export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// The last `days` days, ending today.
export function presetRange(days: number, today: Date = new Date()): { from: string; to: string } {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
  return { from: isoDate(from), to: isoDate(today) }
}

// Which preset a range is, if any, so its button shows as selected.
export function matchingPreset(from: string, to: string, today: Date = new Date()): Preset | null {
  return PRESETS.find((days) => {
    const range = presetRange(days, today)
    return range.from === from && range.to === to
  }) ?? null
}

// "Nov 3", or "Nov 3, 2026" when the year matters.
export function shortDate(value: string, withYear = false): string {
  return parseIsoDate(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function rangeLabel(from: string, to: string): string {
  return `${shortDate(from, true)} – ${shortDate(to, true)}`
}
