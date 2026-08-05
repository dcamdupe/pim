import { describe, it, expect } from 'vitest'
import { computeRange, pastSixMonthOptions } from '../../FrontEnd/src/utils/transactionDateRange'

const today = new Date(2026, 7, 5) // 5 Aug 2026

describe('computeRange', () => {
  it('week: 7 days back from today', () => {
    expect(computeRange('week', today)).toEqual({ startDate: '2026-07-29', endDate: '2026-08-05' })
  })

  it('month: 1 month back from today', () => {
    expect(computeRange('month', today)).toEqual({ startDate: '2026-07-05', endDate: '2026-08-05' })
  })

  it('threeMonths: 3 months back from today', () => {
    expect(computeRange('threeMonths', today)).toEqual({ startDate: '2026-05-05', endDate: '2026-08-05' })
  })

  it('year: 12 months back from today (rolling, not the previous calendar year)', () => {
    expect(computeRange('year', today)).toEqual({ startDate: '2025-08-05', endDate: '2026-08-05' })
  })

  it('allTime: no startDate, endDate is today - the Api resolves the real earliest date', () => {
    expect(computeRange('allTime', today)).toEqual({ startDate: undefined, endDate: '2026-08-05' })
  })

  it('financialYear: the most recently completed 1 Jul - 30 Jun Australian FY', () => {
    expect(computeRange('financialYear', today)).toEqual({ startDate: '2025-07-01', endDate: '2026-06-30' })
  })

  it('financialYear: still resolves to the prior FY the day before it rolls over (30 Jun)', () => {
    expect(computeRange('financialYear', new Date(2026, 5, 30))).toEqual({ startDate: '2024-07-01', endDate: '2025-06-30' })
  })

  it('financialYear: rolls over to the newly-completed FY on 1 Jul', () => {
    expect(computeRange('financialYear', new Date(2026, 6, 1))).toEqual({ startDate: '2025-07-01', endDate: '2026-06-30' })
  })

  it('month:YYYY-MM: that calendar month\'s own start and end', () => {
    expect(computeRange('month:2026-06', today)).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' })
  })

  it('month:YYYY-MM: resolves the correct last day for a shorter month', () => {
    expect(computeRange('month:2026-02', today)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' })
  })
})

describe('pastSixMonthOptions', () => {
  it('lists the 6 full calendar months before the current one, newest first', () => {
    expect(pastSixMonthOptions(today)).toEqual([
      { value: 'month:2026-07', label: 'July 2026' },
      { value: 'month:2026-06', label: 'June 2026' },
      { value: 'month:2026-05', label: 'May 2026' },
      { value: 'month:2026-04', label: 'April 2026' },
      { value: 'month:2026-03', label: 'March 2026' },
      { value: 'month:2026-02', label: 'February 2026' },
    ])
  })

  it('crosses a year boundary correctly', () => {
    expect(pastSixMonthOptions(new Date(2026, 1, 15)).map((m) => m.value)).toEqual([
      'month:2026-01',
      'month:2025-12',
      'month:2025-11',
      'month:2025-10',
      'month:2025-09',
      'month:2025-08',
    ])
  })
})
