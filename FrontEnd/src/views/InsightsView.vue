<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTransactionsStore } from '../stores/transactions'
import { useSettingsStore } from '../stores/settings'
import { categoryColor } from '../services/categoriesService'
import { computeAvailableMonths } from '../utils/dashboardMetrics'
import {
  THRESHOLD_AMT,
  THRESHOLD_PCT,
  addMonths,
  computeCategoryInsights,
  computeDrivers,
  defaultInsightMonth,
  formatMoney,
  formatPct,
  formatSigned,
  groupInsights,
  parseMonthKeyToMonth,
  shortMonthLabel,
  summarise,
  type CategoryInsight,
} from '../utils/spendingInsights'
import InsightCard from '../components/InsightCard.vue'
import InsightDetail from '../components/InsightDetail.vue'

// Spending trends (UBE-118), implementing docs/design/spending-trends-mockup.html from the
// transactions already held client side - no extra Api calls beyond the shared stores' load().
const FALLBACK_COLOUR = '#9093a3'

const today = new Date()
const transactionsStore = useTransactionsStore()
const { transactions } = storeToRefs(transactionsStore)
const settingsStore = useSettingsStore()

const loading = ref(true)
const loadError = ref('')

const minTransactionDate = computed(() =>
  settingsStore.minTransactionDate ? new Date(`${settingsStore.minTransactionDate}T00:00:00`) : null,
)
// Newest first, e.g. ['2026-11', '2026-10', ...].
const availableKeys = computed(() => computeAvailableMonths(minTransactionDate.value, today).map((m) => m.value))
const selectedKey = ref(defaultInsightMonth(today, availableKeys.value))
const selected = computed(() => parseMonthKeyToMonth(selectedKey.value))
const selectedIndex = computed(() => availableKeys.value.indexOf(selectedKey.value))
const canGoBack = computed(() => selectedIndex.value >= 0 && selectedIndex.value < availableKeys.value.length - 1)
const canGoForward = computed(() => selectedIndex.value > 0)

// Until the user steps, keep re-defaulting as history (settings) and transactions finish loading.
let userNavigated = false

function step(delta: number) {
  const next = availableKeys.value[selectedIndex.value - delta]
  if (next) {
    userNavigated = true
    selectedKey.value = next
  }
}

function resetToDefaultMonth() {
  if (!userNavigated) {
    selectedKey.value = defaultInsightMonth(today, availableKeys.value)
  }
}

const insights = computed(() => computeCategoryInsights(transactions.value, selected.value))
const groups = computed(() => groupInsights(insights.value))
const summary = computed(() => summarise(insights.value, groups.value))

// The detail panel follows the clicked card, defaulting to the biggest change for the month.
const selectedCategory = ref<string | null>(null)
watch(selectedKey, () => {
  selectedCategory.value = null
})
const detailInsight = computed<CategoryInsight | null>(() => {
  const chosen = insights.value.find((a) => a.name === selectedCategory.value)
  return chosen ?? summary.value.biggest ?? groups.value.minor[0] ?? null
})
const drivers = computed(() =>
  detailInsight.value ? computeDrivers(transactions.value, detailInsight.value, selected.value) : [],
)

const previousLabel = computed(() => shortMonthLabel(addMonths(selected.value, -1)))
const monthLabel = computed(() => `${shortMonthLabel(selected.value)} vs ${previousLabel.value}`)
const prevMonthName = computed(() => previousLabel.value.split(' ')[0])

function colourOf(a: CategoryInsight): string {
  return (a.category && categoryColor(a.category)) || FALLBACK_COLOUR
}

function changeClass(change: number): string {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
}

function plural(count: number): string {
  return `${count} ${count === 1 ? 'category' : 'categories'}`
}

onMounted(async () => {
  void settingsStore
    .load()
    .then(resetToDefaultMonth)
    .catch(() => {})
  try {
    await transactionsStore.load()
    resetToDefaultMonth()
  } catch {
    loadError.value = 'Could not load your transactions. Please try again later.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="insights-page">
    <header class="page-head">
      <div>
        <h1>Spending trends</h1>
        <p>Categories where your spending changed noticeably from one month to the next.</p>
      </div>
      <div class="controls">
        <div class="stepper" role="group" aria-label="Month">
          <button type="button" aria-label="Previous month" :disabled="!canGoBack" @click="step(-1)">‹</button>
          <span data-testid="insights-month">{{ monthLabel }}</span>
          <button type="button" aria-label="Next month" :disabled="!canGoForward" @click="step(1)">›</button>
        </div>
        <span class="chip">
          Flag changes over <b>{{ Math.round(THRESHOLD_PCT * 100) }}%</b> and <b>{{ formatMoney(THRESHOLD_AMT) }}</b>
        </span>
      </div>
    </header>

    <p v-if="loading" class="status">Loading…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>
    <p v-else-if="insights.length === 0" class="status">No spending in the six months to {{ shortMonthLabel(selected) }}.</p>

    <template v-else>
      <section class="summary" aria-label="Summary">
        <div class="stat">
          <span class="kicker">Total spending</span>
          <span class="value num" data-testid="summary-total">{{ formatMoney(summary.totalCur) }}</span>
          <span class="sub">
            <span v-if="summary.totalRatio !== null" class="pill" :class="changeClass(summary.totalChange)">
              {{ formatPct(summary.totalRatio) }}
            </span>
            {{ formatSigned(summary.totalChange) }} on {{ prevMonthName }}
          </span>
        </div>
        <div class="stat">
          <span class="kicker">Spending more</span>
          <span class="value num">{{ plural(summary.upCount) }}</span>
          <span class="sub">{{ formatSigned(summary.upChange) }} combined</span>
        </div>
        <div class="stat">
          <span class="kicker">Spending less</span>
          <span class="value num">{{ plural(summary.downCount) }}</span>
          <span class="sub">{{ formatSigned(summary.downChange) }} combined</span>
        </div>
        <div class="stat">
          <span class="kicker">Biggest change</span>
          <template v-if="summary.biggest">
            <span class="value">{{ summary.biggest.name }}</span>
            <span class="sub">
              {{ formatSigned(summary.biggest.change) }}{{
                summary.biggest.ratio === null ? ', new this month' : `, ${formatPct(summary.biggest.ratio)}`
              }}
            </span>
          </template>
          <template v-else>
            <span class="value">—</span>
            <span class="sub">No big changes</span>
          </template>
        </div>
      </section>

      <div class="main">
        <section aria-label="Category changes">
          <p v-if="groups.up.length === 0 && groups.down.length === 0" class="status quiet">
            No big changes this month.
          </p>
          <div v-if="groups.up.length" class="group" data-testid="group-up">
            <div class="group-head">
              <h2>Spending more</h2>
              <span class="total num">{{ formatSigned(summary.upChange) }}</span>
            </div>
            <InsightCard
              v-for="a in groups.up"
              :key="a.name"
              :insight="a"
              :colour="colourOf(a)"
              :selected="selected"
              :pressed="detailInsight?.name === a.name"
              @select="selectedCategory = a.name"
            />
          </div>
          <div v-if="groups.down.length" class="group" data-testid="group-down">
            <div class="group-head">
              <h2>Spending less</h2>
              <span class="total num">{{ formatSigned(summary.downChange) }}</span>
            </div>
            <InsightCard
              v-for="a in groups.down"
              :key="a.name"
              :insight="a"
              :colour="colourOf(a)"
              :selected="selected"
              :pressed="detailInsight?.name === a.name"
              @select="selectedCategory = a.name"
            />
          </div>
          <div v-if="groups.minor.length" class="group">
            <details class="minor">
              <summary><span>Smaller changes · {{ plural(groups.minor.length) }}</span></summary>
              <table>
                <tbody>
                  <tr v-for="a in groups.minor" :key="a.name">
                    <td>
                      <button type="button" class="minor-name" @click="selectedCategory = a.name">
                        <span class="dot" :style="{ background: colourOf(a) }"></span>{{ a.name }}
                      </button>
                    </td>
                    <td class="num">
                      {{ formatMoney(a.prev) }} → {{ formatMoney(a.cur) }}
                      <span class="pill" :class="changeClass(Math.round(a.change))">
                        {{ Math.round(a.change) === 0 ? 'no change' : formatSigned(a.change) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </details>
          </div>
        </section>
        <InsightDetail v-if="detailInsight" :insight="detailInsight" :drivers="drivers" :selected="selected" />
      </div>
    </template>
  </main>
</template>

<style scoped>
.insights-page {
  --up: #c62f2f;
  --up-soft: rgba(211, 51, 51, 0.11);
  --down: #0b8a0b;
  --down-soft: rgba(12, 163, 12, 0.12);
  --accent-soft: rgba(15, 118, 110, 0.1);
  --mono: ui-monospace, 'SF Mono', Menlo, monospace;

  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@media (prefers-color-scheme: dark) {
  .insights-page {
    --up: #f87171;
    --up-soft: rgba(248, 113, 113, 0.14);
    --down: #4ade80;
    --down-soft: rgba(74, 222, 128, 0.13);
    --accent-soft: rgba(45, 212, 191, 0.12);
  }
}

h1,
h2 {
  margin: 0;
  color: var(--text-h);
}

.page-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.page-head h1 {
  font-size: 26px;
}

.page-head p {
  margin: 4px 0 0;
  color: var(--text);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.stepper {
  display: flex;
  align-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.stepper button {
  background: none;
  border: 0;
  padding: 7px 11px;
  color: var(--text);
}

.stepper button:hover:not(:disabled) {
  color: var(--text-h);
  filter: none;
}

.stepper button:disabled {
  opacity: 0.35;
  cursor: default;
}

.stepper span {
  padding: 7px 4px;
  font-weight: 600;
  color: var(--text-h);
  min-width: 150px;
  text-align: center;
}

.chip {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--text);
}

.chip b {
  color: var(--text-h);
  font-weight: 600;
}

.status {
  margin: 0;
  color: var(--text);
}

.status-error {
  color: #d33;
}

.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.stat {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat .value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-h);
}

.stat .sub {
  font-size: 12px;
  color: var(--text);
}

.main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 20px;
  align-items: start;
}

@media (max-width: 880px) {
  .main {
    grid-template-columns: 1fr;
  }
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group + .group {
  margin-top: 18px;
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.group-head h2 {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text);
  font-weight: 700;
}

.group-head .total {
  font-size: 12px;
  color: var(--text);
}

.minor {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.minor summary {
  cursor: pointer;
  padding: 11px 14px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  list-style: none;
  color: var(--text);
}

.minor summary::-webkit-details-marker {
  display: none;
}

.minor summary::after {
  content: '▾';
}

.minor[open] summary::after {
  content: '▴';
}

.minor table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.minor td {
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  color: var(--text-h);
}

.minor td:last-child {
  text-align: right;
}

.minor-name {
  background: none;
  border: 0;
  padding: 0;
  color: var(--text-h);
  font: inherit;
  text-align: left;
}

.minor-name:hover {
  text-decoration: underline;
  filter: none;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: 1px;
}

/* Shared by the child InsightCard / InsightDetail components. */
.insights-page :deep(.kicker) {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
}

.insights-page :deep(.num) {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

.insights-page :deep(.pill) {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
  display: inline-block;
}

.insights-page :deep(.pill.up) {
  background: var(--up-soft);
  color: var(--up);
}

.insights-page :deep(.pill.down) {
  background: var(--down-soft);
  color: var(--down);
}

.insights-page :deep(.pill.flat) {
  background: var(--field-bg);
  color: var(--text);
}

.insights-page :deep(.pill.tag) {
  background: var(--accent-soft);
  color: var(--accent);
  font-family: var(--sans);
}
</style>
