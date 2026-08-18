import type { Transaction } from '../services/transactionsService'

const HEADER = ['Date', 'Description', 'Account', 'Category', 'Amount']

// RFC4180-style: wrap in quotes (doubling any embedded quotes) only when the field contains a
// comma, quote, or newline - matches how most spreadsheet apps read/write CSV.
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) =>
    [t.date, csvField(t.description), csvField(t.account), csvField(t.category), t.amount.toFixed(2)].join(','),
  )

  return [HEADER.join(','), ...rows].join('\n')
}
