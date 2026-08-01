<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getTransactions, type Transaction } from '../services/transactionsService'
import { formatDateForApi } from '../utils/dateFormat'
import { computeDashboardTiles, getCurrentMonthRange, getPreviousSixMonthsRange } from '../utils/dashboardMetrics'
import DashboardTile from '../components/DashboardTile.vue'

const today = new Date()
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadError = ref('')

const tiles = computed(() => computeDashboardTiles(transactions.value, today))
const currentMonthLabel = today.toLocaleDateString(undefined, { month: 'long' })

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

    <div v-else class="kpi-row">
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
</style>
