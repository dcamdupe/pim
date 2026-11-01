import type { Transaction } from '../services/transactionsService'
import { MONTH_ABBREVIATIONS, MONTH_NAMES } from './dashboardMetrics'

// Month-on-month spending trends per category for the Insights tab (UBE-118), ported from
// docs/design/spending-trends-mockup.html's analyse()/headline(). Spend uses the dashboard's rules:
// Expense-type transactions plus uncategorised money-out, net of refunds, ignored ones skipped.

export const THRESHOLD_PCT = 0.2
export const THRESHOLD_AMT = 50
export const UNCATEGORISED = 'Uncategorised'
export const MAX_DRIVERS = 8

export type InsightTag = 'New this month' | 'Highest in 6 months' | 'Lowest in 6 months' | 'Rising 3 months' | 'Looks quarterly'

// A calendar month, `month` 0-based like Date.
export interface CalendarMonth {
  year: number
  month: number
}

export interface CategoryInsight {
  name: string
  // Raw category value on transactions ('' for uncategorised) - used for the Transactions link.
  category: string
  // Six months, oldest first; the last is the selected month.
  spend: number[]
  cur: number
  prev: number
  change: number
  // null when the previous month had no spend.
  ratio: number | null
  avg: number
  tags: InsightTag[]
  flagged: boolean
}

export interface InsightGroups {
  up: CategoryInsight[]
  down: CategoryInsight[]
  minor: CategoryInsight[]
}

export interface InsightSummary {
  totalCur: number
  totalPrev: number
  totalChange: number
  totalRatio: number | null
  upCount: number
  upChange: number
  downCount: number
  downChange: number
  biggest: CategoryInsight | null
}

export interface Driver {
  name: string
  prev: number
  cur: number
  change: number
  meta: string
}

export function addMonths(m: CalendarMonth, delta: number): CalendarMonth {
  const index = m.year * 12 + m.month + delta
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
}

export function monthKeyOf(m: CalendarMonth): string {
  return `${m.year}-${String(m.month + 1).padStart(2, '0')}`
}

export function parseMonthKeyToMonth(key: string): CalendarMonth {
  const [year, month] = key.split('-').map(Number)
  return { year, month: month - 1 }
}

export function shortMonthLabel(m: CalendarMonth): string {
  return `${MONTH_ABBREVIATIONS[m.month]} ${m.year}`
}

export function monthName(m: CalendarMonth): string {
  return MONTH_NAMES[m.month]
}

// The six months ending with `selected`, oldest first.
export function sixMonthWindow(selected: CalendarMonth): CalendarMonth[] {
  return [5, 4, 3, 2, 1, 0].map((back) => addMonths(selected, -back))
}

// Last full month by default, unless history doesn't reach back that far.
export function defaultInsightMonth(today: Date, availableKeys: string[]): string {
  const current = { year: today.getFullYear(), month: today.getMonth() }
  const lastFull = monthKeyOf(addMonths(current, -1))
  return availableKeys.includes(lastFull) ? lastFull : monthKeyOf(current)
}

function isSpend(t: Transaction): boolean {
  if (t.ignore) {
    return false
  }
  return t.type === 'Expense' || (t.type === null && t.amount < 0)
}

function categoryName(t: Transaction): string {
  return t.category || UNCATEGORISED
}

function inMonth(t: Transaction, m: CalendarMonth): boolean {
  return t.date.startsWith(monthKeyOf(m))
}

// Net spend per category per month across the window; refunds reduce it, never below 0.
function spendSeries(transactions: Transaction[], window: CalendarMonth[]): Map<string, { category: string; spend: number[] }> {
  const keys = window.map(monthKeyOf)
  const series = new Map<string, { category: string; spend: number[] }>()
  for (const t of transactions) {
    if (!isSpend(t)) {
      continue
    }
    const index = keys.indexOf(t.date.slice(0, 7))
    if (index < 0) {
      continue
    }
    const name = categoryName(t)
    const entry = series.get(name) ?? { category: t.category, spend: keys.map(() => 0) }
    entry.spend[index] -= t.amount
    series.set(name, entry)
  }
  for (const entry of series.values()) {
    entry.spend = entry.spend.map((v) => Math.max(0, v))
  }
  return series
}

export function analyse(name: string, category: string, spend: number[]): CategoryInsight {
  const cur = spend[5]
  const prev = spend[4]
  const change = cur - prev
  const ratio = prev === 0 ? null : change / prev
  const prior = spend.slice(0, 5)
  const avg = spend.reduce((a, b) => a + b, 0) / spend.length
  const tags: InsightTag[] = []
  if (prior.every((v) => v === 0) && cur > 0) {
    tags.push('New this month')
  } else {
    if (cur > Math.max(...prior)) tags.push('Highest in 6 months')
    if (cur < Math.min(...prior)) tags.push('Lowest in 6 months')
    if (spend[5] > spend[4] && spend[4] > spend[3] && spend[3] > spend[2]) tags.push('Rising 3 months')
    if (change > 0 && spend[2] > avg * 1.25 && cur > 0 && Math.abs(spend[2] - cur) / cur < 0.15) tags.push('Looks quarterly')
  }
  const flagged = Math.abs(change) >= THRESHOLD_AMT && (ratio === null || Math.abs(ratio) >= THRESHOLD_PCT)
  return { name, category, spend, cur, prev, change, ratio, avg, tags, flagged }
}

// One insight per category with any spend in the six months ending with `selected`.
export function computeCategoryInsights(transactions: Transaction[], selected: CalendarMonth): CategoryInsight[] {
  const series = spendSeries(transactions, sixMonthWindow(selected))
  return [...series.entries()]
    .filter(([, entry]) => entry.spend.some((v) => v > 0))
    .map(([name, entry]) => analyse(name, entry.category, entry.spend))
}

export function groupInsights(insights: CategoryInsight[]): InsightGroups {
  return {
    up: insights.filter((a) => a.flagged && a.change > 0).sort((x, y) => y.change - x.change),
    down: insights.filter((a) => a.flagged && a.change < 0).sort((x, y) => x.change - y.change),
    minor: insights.filter((a) => !a.flagged).sort((x, y) => Math.abs(y.change) - Math.abs(x.change)),
  }
}

export function summarise(insights: CategoryInsight[], groups: InsightGroups): InsightSummary {
  const sum = (list: CategoryInsight[], pick: (a: CategoryInsight) => number) => list.reduce((t, a) => t + pick(a), 0)
  const totalCur = sum(insights, (a) => a.cur)
  const totalPrev = sum(insights, (a) => a.prev)
  const flagged = [...groups.up, ...groups.down].sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
  return {
    totalCur,
    totalPrev,
    totalChange: totalCur - totalPrev,
    totalRatio: totalPrev === 0 ? null : (totalCur - totalPrev) / totalPrev,
    upCount: groups.up.length,
    upChange: sum(groups.up, (a) => a.change),
    downCount: groups.down.length,
    downChange: sum(groups.down, (a) => a.change),
    biggest: flagged[0] ?? null,
  }
}

export function formatMoney(value: number, dp = 0): string {
  return `$${Math.abs(value).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`
}

export function formatSigned(value: number, dp = 0): string {
  const rounded = Number(value.toFixed(dp))
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${formatMoney(rounded, dp)}`
}

export function formatPct(ratio: number): string {
  const pct = Math.round(Math.abs(ratio) * 100)
  return `${ratio > 0 && pct > 0 ? '+' : ratio < 0 && pct > 0 ? '−' : ''}${pct}%`
}

export function headline(a: CategoryInsight, selected: CalendarMonth): string {
  if (a.tags.includes('New this month')) {
    return `${formatMoney(a.cur)} spent, nothing in the last 5 months`
  }
  const prevName = monthName(addMonths(selected, -1))
  if (Math.round(a.change) === 0) {
    return `no change on ${prevName} (${formatMoney(a.cur)})`
  }
  const dir = a.change > 0 ? 'up' : 'down'
  return `${dir} ${formatMoney(a.change)} on ${prevName} (${formatMoney(a.prev)} → ${formatMoney(a.cur)})`
}

// Groups a description by merchant: its first word with digits/punctuation stripped, so
// "WOOLWORTHS 1294 HORNSBY" and "WOOLWORTHS 1045 CASTLE HILL" both become "WOOLWORTHS".
export function merchantKey(description: string): string {
  for (const word of description.trim().split(/\s+/)) {
    const letters = word.replace(/[^\p{L}]/gu, '')
    if (letters) {
      return letters.toUpperCase()
    }
  }
  return description.trim().toUpperCase() || 'UNKNOWN'
}

// The merchants behind a category's change between the previous and selected month, biggest
// absolute change first.
export function computeDrivers(transactions: Transaction[], insight: CategoryInsight, selected: CalendarMonth): Driver[] {
  const previous = addMonths(selected, -1)
  const merchants = new Map<string, { prev: number; cur: number; prevCount: number; curCount: number; descriptions: Set<string> }>()

  for (const t of transactions) {
    if (!isSpend(t) || categoryName(t) !== insight.name) {
      continue
    }
    const isCur = inMonth(t, selected)
    if (!isCur && !inMonth(t, previous)) {
      continue
    }
    const key = merchantKey(t.description)
    const entry = merchants.get(key) ?? { prev: 0, cur: 0, prevCount: 0, curCount: 0, descriptions: new Set<string>() }
    if (isCur) {
      entry.cur -= t.amount
      entry.curCount += t.amount < 0 ? 1 : 0
    } else {
      entry.prev -= t.amount
      entry.prevCount += t.amount < 0 ? 1 : 0
    }
    entry.descriptions.add(t.description)
    merchants.set(key, entry)
  }

  return [...merchants.entries()]
    .map(([name, e]) => {
      const prev = Math.max(0, e.prev)
      const cur = Math.max(0, e.cur)
      let meta = ''
      if (prev === 0 && cur > 0) meta = `Not seen in ${monthName(previous)}`
      else if (cur === 0 && prev > 0) meta = `Not seen in ${monthName(selected)}`
      else if (e.curCount !== e.prevCount) meta = `${e.curCount} visit${e.curCount === 1 ? '' : 's'}, was ${e.prevCount}`
      else if (e.descriptions.size > 1) meta = `Grouped: ${e.descriptions.size} descriptions`
      return { name, prev, cur, change: cur - prev, meta }
    })
    .filter((d) => d.prev > 0 || d.cur > 0)
    .sort((x, y) => Math.abs(y.change) - Math.abs(x.change) || x.name.localeCompare(y.name))
    .slice(0, MAX_DRIVERS)
}
