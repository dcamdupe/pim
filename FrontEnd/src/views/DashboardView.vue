<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTransactionsStore } from '../stores/transactions'
import { useSettingsStore } from '../stores/settings'
import {
  computeDashboardTiles,
  computeExpensesByCategory,
  computeMonthlyIncomeExpenses,
  computeAvailableMonths,
  formatMonthYear,
  formatSixMonthRangeLabel,
  parseMonthKey,
  computeRecentTransactions,
} from '../utils/dashboardMetrics'
import { loadStoredDashboardFilters, saveDashboardFilters } from '../utils/dashboardFilterStorage'
import DashboardTile from '../components/DashboardTile.vue'
import SpendingByCategoryChart from '../components/SpendingByCategoryChart.vue'
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart.vue'
import RecentTransactionsList from '../components/RecentTransactionsList.vue'

// The real "today", used as the upper bound for the month filter - distinct from `selectedMonth`,
// which the user can wind back via the filter.
const realToday = new Date()

const transactionsStore = useTransactionsStore()
const { transactions } = storeToRefs(transactionsStore)
const settingsStore = useSettingsStore()

// Gates each section's own loading state (not the page shell, which always renders) while the
// shared store's initial load() is in flight - switching the month filter afterwards is a
// synchronous recompute over the already-loaded data, not a fetch.
const initialLoading = ref(true)
const loadError = ref('')
const minTransactionDate = computed(() =>
  settingsStore.minTransactionDate ? new Date(`${settingsStore.minTransactionDate}T00:00:00`) : null,
)
const storedFilters = loadStoredDashboardFilters()
const selectedMonthKey = ref(storedFilters?.month ?? computeAvailableMonths(null, realToday)[0].value)

const availableMonths = computed(() => computeAvailableMonths(minTransactionDate.value, realToday))
const selectedMonth = computed(() => parseMonthKey(selectedMonthKey.value))

watch(selectedMonthKey, (month) => {
  saveDashboardFilters({ month })
})

const tiles = computed(() => computeDashboardTiles(transactions.value, selectedMonth.value))
const expensesByCategory = computed(() => computeExpensesByCategory(transactions.value, selectedMonth.value))
const monthlyIncomeExpenses = computed(() => computeMonthlyIncomeExpenses(transactions.value, selectedMonth.value))
const recentTransactions = computed(() => computeRecentTransactions(transactions.value))
const selectedMonthLabel = computed(() => formatMonthYear(selectedMonth.value))
const sixMonthRangeLabel = computed(() => formatSixMonthRangeLabel(selectedMonth.value))

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

onMounted(async () => {
  // Non-fatal if this fails - the month filter just falls back to only the current month.
  void settingsStore.load().catch(() => {})

  try {
    await transactionsStore.load()
  } catch {
    loadError.value = 'Could not load your dashboard. Please try again later.'
  } finally {
    initialLoading.value = false
  }
})
</script>

<template>
  <div class="dashboard-page">
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">Your financial overview.</p>
      </div>
      <select v-model="selectedMonthKey" aria-label="Month filter" class="month-select" :disabled="initialLoading">
        <option v-for="m in availableMonths" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>
    </div>

    <p v-if="loadError" class="status status-error">{{ loadError }}</p>

    <div class="kpi-row">
      <DashboardTile
        kicker="Profit"
        :label="selectedMonthLabel"
        :value="formatCurrency(tiles.currentMonthProfit)"
        show-delta
        :delta-pct="tiles.currentMonthProfitDeltaPct"
        :loading="initialLoading"
      />
      <DashboardTile
        kicker="Profit"
        :label="`Average · ${sixMonthRangeLabel}`"
        :value="formatCurrency(tiles.previousSixMonthsProfitAverage)"
        :loading="initialLoading"
      />
      <DashboardTile
        kicker="Expenses"
        :label="selectedMonthLabel"
        :value="formatCurrency(tiles.currentMonthExpenses)"
        show-delta
        :delta-pct="tiles.currentMonthExpensesDeltaPct"
        :loading="initialLoading"
      />
      <DashboardTile
        kicker="Expenses"
        :label="`Average · ${sixMonthRangeLabel}`"
        :value="formatCurrency(tiles.previousSixMonthsExpensesAverage)"
        :loading="initialLoading"
      />
    </div>

    <div class="charts-row">
      <div class="card">
        <h2>Spending by category</h2>
        <p v-if="initialLoading" class="card-sub status">Loading…</p>
        <template v-else>
          <p class="card-sub">{{ selectedMonthLabel }} · {{ formatCurrency(tiles.currentMonthExpenses) }} total</p>
          <SpendingByCategoryChart :expenses="expensesByCategory" :center-value="formatCurrency(tiles.currentMonthExpenses)" />
        </template>
      </div>

      <div class="card">
        <h2>Income vs. expenses</h2>
        <p v-if="initialLoading" class="card-sub status">Loading…</p>
        <template v-else>
          <p class="card-sub">{{ sixMonthRangeLabel }}</p>
          <IncomeVsExpensesChart :data="monthlyIncomeExpenses" />
        </template>
      </div>
    </div>

    <div class="card recent-card">
      <div class="recent-head">
        <h2>Recent transactions</h2>
        <RouterLink to="/transactions" class="view-all">View all →</RouterLink>
      </div>
      <p v-if="initialLoading" class="status">Loading…</p>
      <RecentTransactionsList v-else :transactions="recentTransactions" />
    </div>
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
