// Parsing/validation for the Budgets page's amount inputs (UBE-119).

export type ParsedBudgetAmount = { kind: 'empty' } | { kind: 'valid'; amount: number } | { kind: 'invalid'; message: string }

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

// Blank means "no budget". Accepts an optional leading "$" and thousands commas.
export function parseBudgetAmount(input: string): ParsedBudgetAmount {
  const cleaned = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (cleaned === '') {
    return { kind: 'empty' }
  }
  if (!AMOUNT_PATTERN.test(cleaned)) {
    return { kind: 'invalid', message: 'Enter an amount like 250 or 99.50.' }
  }
  const amount = Number(cleaned)
  if (amount <= 0) {
    return { kind: 'invalid', message: 'Enter an amount greater than 0.' }
  }
  return { kind: 'valid', amount }
}

// Sum of the valid amounts, rounded to cents to avoid float drift.
export function totalBudget(inputs: string[]): number {
  const cents = inputs.reduce((sum, input) => {
    const parsed = parseBudgetAmount(input)
    return parsed.kind === 'valid' ? sum + Math.round(parsed.amount * 100) : sum
  }, 0)
  return cents / 100
}

// Shows a stored amount in its input: whole dollars without decimals, otherwise 2 places.
export function formatBudgetInput(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}
