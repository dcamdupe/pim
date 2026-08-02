<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getTransactions, type Transaction } from '../services/transactionsService'
import { getSettings } from '../services/settingsService'
import { formatDateForApi } from '../utils/dateFormat'
import {
  computeDashboardTiles,
  computeExpensesByCategory,
  computeMonthlyIncomeExpenses,
  computeAvailableMonths,
  formatMonthYear,
  formatSixMonthRangeLabel,
  parseMonthKey,
  computeRecentTransactions,
  getCurrentMonthRange,
  getPreviousSixMonthsRange,
} from '../utils/dashboardMetrics'
import DashboardTile from '../components/DashboardTile.vue'
import SpendingByCategoryChart from '../components/SpendingByCategoryChart.vue'
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart.vue'
import RecentTransactionsList from '../components/RecentTransactionsList.vue'
import LoadingSpinner from '../components/LoadingSpinner.vue'

// The real "today", used as the upper bound for the month filter - distinct from `selectedMonth`,
// which the user can wind back via the filter.
const realToday = new Date()

const transactions = ref<Transaction[]>([])
// True only until the very first fetch (on mount) resolves - gates the full-page loading/error
// state, since there's nothing to show yet. A later month-switch fetch uses chartsLoading/
// chartsError instead, so it never blanks the page - see fetchTransactionsForSelectedMonth.
const initialLoading = ref(true)
const chartsLoading = ref(false)
const loadError = ref('')
const chartsError = ref('')
const minTransactionDate = ref<Date | null>(null)
const selectedMonthKey = ref(computeAvailableMonths(null, realToday)[0].value)
// Only updates once the fetch for `selectedMonthKey` has resolved, so every tile/chart on screen
// always reflects one single, consistent (month, transactions) pairing - never a half-updated mix
// of the newly-picked month's label with the previous month's figures while a fetch is in flight.
const appliedMonthKey = ref(selectedMonthKey.value)

const availableMonths = computed(() => computeAvailableMonths(minTransactionDate.value, realToday))
const appliedMonth = computed(() => parseMonthKey(appliedMonthKey.value))
const isFetching = computed(() => initialLoading.value || chartsLoading.value)

const tiles = computed(() => computeDashboardTiles(transactions.value, appliedMonth.value))
const expensesByCategory = computed(() => computeExpensesByCategory(transactions.value, appliedMonth.value))
const monthlyIncomeExpenses = computed(() => computeMonthlyIncomeExpenses(transactions.value, appliedMonth.value))
const recentTransactions = computed(() => computeRecentTransactions(transactions.value))
const selectedMonthLabel = computed(() => formatMonthYear(appliedMonth.value))
const sixMonthRangeLabel = computed(() => formatSixMonthRangeLabel(appliedMonth.value))

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

async function fetchTransactionsForSelectedMonth() {
  const monthKey = selectedMonthKey.value
  const isInitial = initialLoading.value

  if (isInitial) {
    loadError.value = ''
  } else {
    chartsLoading.value = true
    chartsError.value = ''
  }

  try {
    const month = parseMonthKey(monthKey)
    const { start } = getPreviousSixMonthsRange(month)
    const { end } = getCurrentMonthRange(month)
    transactions.value = await getTransactions(formatDateForApi(start), formatDateForApi(end))
    appliedMonthKey.value = monthKey
  } catch {
    const message = 'Could not load your dashboard. Please try again later.'
    if (isInitial) {
      loadError.value = message
    } else {
      chartsError.value = message
    }
  } finally {
    initialLoading.value = false
    chartsLoading.value = false
  }
}

watch(selectedMonthKey, fetchTransactionsForSelectedMonth)

onMounted(async () => {
  // Non-fatal if this fails - the month filter just falls back to only the current month.
  getSettings()
    .then((settings) => {
      minTransactionDate.value = settings.minTransactionDate ? new Date(`${settings.minTransactionDate}T00:00:00`) : null
    })
    .catch(() => {})

  await fetchTransactionsForSelectedMonth()
})
</script>

<template>
  <div class="dashboard-page">
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">Your financial overview.</p>
      </div>
      <select v-model="selectedMonthKey" aria-label="Month filter" class="month-select" :disabled="isFetching">
        <option v-for="m in availableMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>

    <p v-if="initialLoading" class="status">Loading dashboard…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>

    <template v-else>
      <div class="kpi-row" :class="{ 'is-loading': chartsLoading }">
        <DashboardTile
          :label="`${selectedMonthLabel} profit`"
          :value="formatCurrency(tiles.currentMonthProfit)"
          show-delta
          :delta-pct="tiles.currentMonthProfitDeltaPct"
        />
        <DashboardTile :label="sixMonthRangeLabel" :value="formatCurrency(tiles.previousSixMonthsProfit)" />
        <DashboardTile
          :label="`${selectedMonthLabel} Expenses`"
          :value="formatCurrency(tiles.currentMonthExpenses)"
          show-delta
          :delta-pct="tiles.currentMonthExpensesDeltaPct"
        />
        <DashboardTile :label="sixMonthRangeLabel" :value="formatCurrency(tiles.previousSixMonthsExpenses)" />
      </div>

      <div class="charts-row">
        <div class="card">
          <h2>Spending by category</h2>
          <p class="card-sub">{{ selectedMonthLabel }} · {{ formatCurrency(tiles.currentMonthExpenses) }} total</p>
          <LoadingSpinner v-if="chartsLoading" label="Loading spending by category" />
          <p v-else-if="chartsError" class="status status-error chart-error">{{ chartsError }}</p>
          <SpendingByCategoryChart
            v-else
            :expenses="expensesByCategory"
            :center-value="formatCurrency(tiles.currentMonthExpenses)"
          />
        </div>

        <div class="card">
          <h2>Income vs. expenses</h2>
          <p class="card-sub">{{ sixMonthRangeLabel }}</p>
          <LoadingSpinner v-if="chartsLoading" label="Loading income vs. expenses" />
          <p v-else-if="chartsError" class="status status-error chart-error">{{ chartsError }}</p>
          <IncomeVsExpensesChart v-else :data="monthlyIncomeExpenses" />
        </div>
      </div>

      <div class="card recent-card">
        <div class="recent-head">
          <h2>Recent transactions</h2>
          <RouterLink to="/transactions" class="view-all">View all →</RouterLink>
        </div>
        <RecentTransactionsList :transactions="recentTransactions" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.dashboard-page h1 {
  margin: 0 0 4px;
}

.subtitle {
  margin: 0 0 24px;
  color: var(--text);
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.month-select {
  flex: 0 0 auto;
}

@media (max-width: 420px) {
  .page-head {
    flex-direction: column;
  }
}

.status {
  color: var(--text);
}

.status-error {
  color: #d33;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  transition: opacity 0.15s ease;
}

.kpi-row.is-loading {
  opacity: 0.6;
}

@media (max-width: 720px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 420px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}

.charts-row {
  margin-top: 16px;
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 16px;
}

@media (max-width: 720px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px 22px 18px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -12px rgba(0, 0, 0, 0.1);
}

.card h2 {
  font-size: 15.5px;
  font-weight: 700;
  margin: 0 0 2px;
}

.card .card-sub {
  font-size: 12px;
  color: var(--text);
  margin: 0 0 16px;
}

.chart-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  text-align: center;
}

.recent-card {
  margin-top: 16px;
}

.recent-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.recent-head h2 {
  margin: 0;
}

.view-all {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-h);
  text-decoration: none;
  white-space: nowrap;
  padding-top: 2px;
}

.view-all:hover {
  text-decoration: underline;
}
</style>
