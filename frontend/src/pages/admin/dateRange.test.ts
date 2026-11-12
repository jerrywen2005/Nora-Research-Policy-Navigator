import { describe, expect, it } from 'vitest'
import { isoDate, matchingPreset, parseIsoDate, presetRange, rangeLabel, shortDate } from './dateRange'

const TODAY = new Date(2026, 10, 12) // Nov 12, 2026, local time

describe('dateRange', () => {
  it('reads and writes calendar dates in local time', () => {
    expect(isoDate(parseIsoDate('2026-03-05'))).toBe('2026-03-05')
    expect(parseIsoDate('2026-11-03').getDate()).toBe(3)
  })

  it('builds inclusive ranges ending today, across month ends', () => {
    expect(presetRange(7, TODAY)).toEqual({ from: '2026-11-06', to: '2026-11-12' })
    expect(presetRange(30, TODAY)).toEqual({ from: '2026-10-14', to: '2026-11-12' })
    expect(presetRange(1, TODAY)).toEqual({ from: '2026-11-12', to: '2026-11-12' })
  })

  it('recognizes a preset range, and only an exact one', () => {
    expect(matchingPreset('2026-11-06', '2026-11-12', TODAY)).toBe(7)
    expect(matchingPreset('2026-08-15', '2026-11-12', TODAY)).toBe(90)
    expect(matchingPreset('2026-11-05', '2026-11-12', TODAY)).toBeNull()
  })

  it('formats dates for labels', () => {
    expect(shortDate('2026-11-03')).toBe('Nov 3')
    expect(shortDate('2026-11-03', true)).toBe('Nov 3, 2026')
    expect(rangeLabel('2026-10-14', '2026-11-12')).toBe('Oct 14, 2026 – Nov 12, 2026')
  })
})
