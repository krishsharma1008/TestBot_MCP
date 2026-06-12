import { describe, it, expect } from 'vitest'
import { toDisplayUnits, REAL_TOKENS_PER_DISPLAY_UNIT } from './token-units'

describe('REAL_TOKENS_PER_DISPLAY_UNIT', () => {
  it('is 4800', () => {
    expect(REAL_TOKENS_PER_DISPLAY_UNIT).toBe(4_800)
  })

  it('maps $12 Starter plan (2.4M tokens) to 500 display units', () => {
    expect(2_400_000 / REAL_TOKENS_PER_DISPLAY_UNIT).toBe(500)
  })

  it('maps $24 Team plan (4.8M tokens) to 1000 display units', () => {
    expect(4_800_000 / REAL_TOKENS_PER_DISPLAY_UNIT).toBe(1_000)
  })
})

describe('toDisplayUnits', () => {
  it('returns 0 for null', () => {
    expect(toDisplayUnits(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(toDisplayUnits(undefined)).toBe(0)
  })

  it('returns 0 for 0 tokens', () => {
    expect(toDisplayUnits(0)).toBe(0)
  })

  it('returns 0 for negative tokens', () => {
    expect(toDisplayUnits(-100)).toBe(0)
  })

  it('returns 0 for NaN', () => {
    expect(toDisplayUnits(NaN)).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(toDisplayUnits(Infinity)).toBe(0)
  })

  it('returns 0 for -Infinity', () => {
    expect(toDisplayUnits(-Infinity)).toBe(0)
  })

  it('floors fractional units', () => {
    // 5000 tokens → 5000/4800 = 1.041 → floor = 1
    expect(toDisplayUnits(5_000)).toBe(1)
  })

  it('returns 1 for exactly 4800 tokens', () => {
    expect(toDisplayUnits(4_800)).toBe(1)
  })

  it('returns 1 for 4799 tokens (floors, not rounds)', () => {
    expect(toDisplayUnits(4_799)).toBe(0)
  })

  it('returns 500 for 2.4M tokens (Starter plan)', () => {
    expect(toDisplayUnits(2_400_000)).toBe(500)
  })

  it('returns 1000 for 4.8M tokens (Team plan)', () => {
    expect(toDisplayUnits(4_800_000)).toBe(1_000)
  })

  it('returns 0 for tokens below one display unit', () => {
    expect(toDisplayUnits(1)).toBe(0)
    expect(toDisplayUnits(4_799)).toBe(0)
  })

  it('handles large token counts', () => {
    expect(toDisplayUnits(48_000_000)).toBe(10_000)
  })

  it('floors partial units (not round)', () => {
    // 9599 tokens → 9599/4800 = 1.999 → floor = 1
    expect(toDisplayUnits(9_599)).toBe(1)
    expect(toDisplayUnits(9_600)).toBe(2)
  })
})
