import { describe, it, expect } from 'vitest'
import { formatBudgetInput, parseBudgetAmount, totalBudget } from '../../FrontEnd/src/utils/budgetAmounts'

describe('parseBudgetAmount', () => {
  it.each(['', '   '])('treats %j as no budget', (input) => {
    expect(parseBudgetAmount(input)).toEqual({ kind: 'empty' })
  })

  it.each([
    ['250', 250],
    ['99.5', 99.5],
    ['99.50', 99.5],
    ['$1,200', 1200],
    [' 42 ', 42],
  ])('parses %j as %d', (input, amount) => {
    expect(parseBudgetAmount(input)).toEqual({ kind: 'valid', amount })
  })

  it.each(['abc', '-5', '1.234', '1.2.3', '12a'])('rejects %j as not an amount', (input) => {
    expect(parseBudgetAmount(input).kind).toBe('invalid')
  })

  it.each(['0', '0.00'])('rejects %j as not greater than 0', (input) => {
    expect(parseBudgetAmount(input)).toEqual({ kind: 'invalid', message: 'Enter an amount greater than 0.' })
  })
})

describe('totalBudget', () => {
  it('sums valid amounts and ignores blank or invalid ones', () => {
    expect(totalBudget(['100', '', 'abc', '50.25'])).toBe(150.25)
  })

  it('avoids floating point drift', () => {
    expect(totalBudget(['0.1', '0.2'])).toBe(0.3)
  })
})

describe('formatBudgetInput', () => {
  it('shows whole dollars without decimals and cents with 2 places', () => {
    expect(formatBudgetInput(800)).toBe('800')
    expect(formatBudgetInput(99.5)).toBe('99.50')
  })
})
