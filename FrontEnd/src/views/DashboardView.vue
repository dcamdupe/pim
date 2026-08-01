<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getTransactions, type Transaction } from '../services/transactionsService'
import { formatDateForApi } from '../utils/dateFormat'
import {
  computeDashboardTiles,
  computeExpensesByCategory,
  computeMonthlyIncomeExpenses,
  getCurrentMonthRange,
  getPreviousSixMonthsRange,
} from '../utils/dashboardMetrics'
import DashboardTile from '../components/DashboardTile.vue'
import SpendingByCategoryChart from '../components/SpendingByCategoryChart.vue'
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart.vue'

const today = new Date()
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadError = ref('')

const tiles = computed(() => computeDashboardTiles(transactions.value, today))
const expensesByCategory = computed(() => computeExpensesByCategory(transactions.value, today))
const monthlyIncomeExpenses = computed(() => computeMonthlyIncomeExpenses(transactions.value, today))
const currentMonthLabel = today.toLocaleDateString(undefined, { month: 'long' })
const currentMonthYearLabel = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

onMounted(async () => {
  loading.value = true
  loadError.value = ''
  try {
    const { start } = getPreviousSixMonthsRange(today)
    const { end } = getCurrentMonthRange(today)
    transactions.value = await getTransactions(formatDateForApi(start), formatDateForApi(end))
  } catch {
    loadError.value = 'Could not load your dashboard. Please try again later.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dashboard-page">
    <h1>Dashboard</h1>
    <p class="subtitle">Your financial overview.</p>

    <p v-if="loading" class="status">Loading dashboard…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>

    <template v-else>
      <div class="kpi-row">
        <DashboardTile
          :label="`${currentMonthLabel} profit`"
          :value="formatCurrency(tiles.currentMonthProfit)"
          show-delta
          :delta-pct="tiles.currentMonthProfitDeltaPct"
        />
        <DashboardTile label="previous 6 month profit" :value="formatCurrency(tiles.previousSixMonthsProfit)" />
        <DashboardTile
          :label="`${currentMonthLabel} Expenses`"
          :value="formatCurrency(tiles.currentMonthExpenses)"
          show-delta
          :delta-pct="tiles.currentMonthExpensesDeltaPct"
        />
        <DashboardTile label="previous 6 month expenses" :value="formatCurrency(tiles.previousSixMonthsExpenses)" />
      </div>

      <div class="charts-row">
        <div class="card">
          <h2>Spending by category</h2>
          <p class="card-sub">{{ currentMonthYearLabel }} · {{ formatCurrency(tiles.currentMonthExpenses) }} total</p>
          <SpendingByCategoryChart
            :expenses="expensesByCategory"
            :center-value="formatCurrency(tiles.currentMonthExpenses)"
          />
        </div>

        <div class="card">
          <h2>Income vs. expenses</h2>
          <p class="card-sub">Last 6 months</p>
          <IncomeVsExpensesChart :data="monthlyIncomeExpenses" />
        </div>
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
</style>
