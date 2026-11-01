<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
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
import { getBudgets, type Budget } from '../services/budgetsService'
import {
  PROJECTION_FILTERS,
  computeBudgetProjection,
  computeMonthlyBudgetVsActual,
  filterProjectionRows,
  isProjectionFilter,
  type ProjectionFilter,
} from '../utils/budgetMetrics'
import DashboardTile from '../components/DashboardTile.vue'
import SpendingByCategoryChart from '../components/SpendingByCategoryChart.vue'
import IncomeVsExpensesChart from '../components/IncomeVsExpensesChart.vue'
import RecentTransactionsList from '../components/RecentTransactionsList.vue'
import BudgetProjectionChart from '../components/BudgetProjectionChart.vue'
import BudgetVsActualChart from '../components/BudgetVsActualChart.vue'

// The real "today", used as the upper bound for the month filter - distinct from `selectedMonth`,
// which the user can wind back via the filter.
const realToday = new Date()

const router = useRouter()
const transactionsStore = useTransactionsStore()
const { transactions } = storeToRefs(transactionsStore)
const settingsStore = useSettingsStore()

// Gates each section's own loading state (not the page shell, which always renders) while the
// shared store's initial load() is in flight; filter changes afterwards are a sync recompute, not a fetch.
const initialLoading = ref(true)
const loadError = ref('')
const minTransactionDate = computed(() =>
  settingsStore.minTransactionDate ? new Date(`${settingsStore.minTransactionDate}T00:00:00`) : null,
)
const storedFilters = loadStoredDashboardFilters()
const selectedMonthKey = ref(storedFilters?.month ?? computeAvailableMonths(null, realToday)[0].value)
const selectedBudgetCategory = ref(storedFilters?.budgetCategory ?? '')
const selectedProjectionFilter = ref<ProjectionFilter>(
  isProjectionFilter(storedFilters?.budgetProjectionFilter) ? storedFilters.budgetProjectionFilter : 'top5',
)
// Budget cards (UBE-124) - loaded separately so a failure doesn't block the rest of the dashboard.
const budgets = ref<Budget[]>([])
const budgetsLoading = ref(true)
const budgetsError = ref('')

const availableMonths = computed(() => computeAvailableMonths(minTransactionDate.value, realToday))
const selectedMonth = computed(() => parseMonthKey(selectedMonthKey.value))

watch(
  [selectedMonthKey, selectedBudgetCategory, selectedProjectionFilter],
  ([month, budgetCategory, budgetProjectionFilter]) => {
    saveDashboardFilters({ month, budgetCategory, budgetProjectionFilter })
  },
)

const tiles = computed(() => computeDashboardTiles(transactions.value, selectedMonth.value))
const expensesByCategory = computed(() => computeExpensesByCategory(transactions.value, selectedMonth.value))
const monthlyIncomeExpenses = computed(() => computeMonthlyIncomeExpenses(transactions.value, selectedMonth.value))
const budgetProjection = computed(() =>
  computeBudgetProjection(transactions.value, budgets.value, selectedMonth.value, realToday),
)
// The card's totals still cover every budget; only the rows shown are filtered.
const filteredProjection = computed(() => ({
  ...budgetProjection.value,
  rows: filterProjectionRows(budgetProjection.value.rows, selectedProjectionFilter.value),
}))
const budgetCategories = computed(() => budgets.value.map((b) => b.category).sort((a, b) => a.localeCompare(b)))
// A stored filter for a category that no longer has a budget falls back to "all".
const effectiveBudgetCategory = computed(() =>
  budgetCategories.value.includes(selectedBudgetCategory.value) ? selectedBudgetCategory.value : '',
)
const monthlyBudgetVsActual = computed(() =>
  computeMonthlyBudgetVsActual(transactions.value, budgets.value, selectedMonth.value, effectiveBudgetCategory.value),
)
const budgetCardsLoading = computed(() => initialLoading.value || budgetsLoading.value)
const recentTransactions = computed(() => computeRecentTransactions(transactions.value))
const selectedMonthLabel = computed(() => formatMonthYear(selectedMonth.value))
const sixMonthRangeLabel = computed(() => formatSixMonthRangeLabel(selectedMonth.value))

function onSelectCategory(category: string) {
  router.push({ path: '/transactions', query: { range: `month:${selectedMonthKey.value}`, category } })
}

function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

onMounted(async () => {
  // Non-fatal if this fails - the month filter just falls back to only the current month.
  void settingsStore.load().catch(() => {})
  void getBudgets()
    .then((result) => {
      budgets.value = result
    })
    .catch(() => {
      budgetsError.value = 'Could not load your budgets.'
    })
    .finally(() => {
      budgetsLoading.value = false
    })

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
          <SpendingByCategoryChart
            :expenses="expensesByCategory"
            :center-value="formatCurrency(tiles.currentMonthExpenses)"
            :center-label="selectedMonthLabel"
            @select="onSelectCategory"
          />
        </template>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Income vs. expenses</h2>
        </div>
        <p v-if="initialLoading" class="card-sub status">Loading…</p>
        <template v-else>
          <p class="card-sub">{{ sixMonthRangeLabel }}</p>
          <IncomeVsExpensesChart :data="monthlyIncomeExpenses" />
        </template>
      </div>
    </div>

    <div class="charts-row budget-row">
      <div class="card" data-testid="budget-projection-card">
        <div class="card-head">
          <h2>{{ budgetProjection.isProjected ? 'Month projection' : 'Month Budget' }}</h2>
          <select
            v-model="selectedProjectionFilter"
            aria-label="Month budget filter"
            :disabled="budgetCardsLoading || budgets.length === 0"
          >
            <option v-for="f in PROJECTION_FILTERS" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <p v-if="budgetCardsLoading" class="card-sub status">Loading…</p>
        <p v-else-if="budgetsError" class="card-sub status">{{ budgetsError }}</p>
        <p v-else-if="budgets.length === 0" class="card-sub status">
          No budgets set. <RouterLink to="/budgets">Set budgets</RouterLink>
        </p>
        <template v-else>
          <p class="card-sub">
            <template v-if="budgetProjection.isProjected">
              Projected {{ formatCurrency(budgetProjection.totalProjected) }} of
              {{ formatCurrency(budgetProjection.totalBudget) }} · day {{ budgetProjection.daysElapsed }} of
              {{ budgetProjection.daysInMonth }}
            </template>
            <template v-else>
              {{ selectedMonthLabel }} · {{ formatCurrency(budgetProjection.totalActual) }} of
              {{ formatCurrency(budgetProjection.totalBudget) }}
            </template>
          </p>
          <BudgetProjectionChart v-if="filteredProjection.rows.length" :projection="filteredProjection" />
          <p v-else class="card-sub status">
            No categories {{ selectedProjectionFilter === 'over' ? 'over' : 'under' }} budget.
          </p>
        </template>
      </div>

      <div class="card" data-testid="budget-history-card">
        <div class="card-head">
          <h2>Budget performance</h2>
          <select
            v-model="selectedBudgetCategory"
            aria-label="Budget performance category"
            :disabled="budgetCardsLoading || budgets.length === 0"
          >
            <option value="">All Categories</option>
            <option v-for="c in budgetCategories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <p v-if="budgetCardsLoading" class="card-sub status">Loading…</p>
        <p v-else-if="budgetsError" class="card-sub status">{{ budgetsError }}</p>
        <p v-else-if="budgets.length === 0" class="card-sub status">
          No budgets set. <RouterLink to="/budgets">Set budgets</RouterLink>
        </p>
        <template v-else>
          <p class="card-sub">Last 6 months to {{ selectedMonthLabel }}</p>
          <BudgetVsActualChart :data="monthlyBudgetVsActual" />
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

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-head h2 {
  margin: 0;
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
