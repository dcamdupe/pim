<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getTransactions, type Transaction } from '../services/transactionsService'

type RangeOption = 'week' | 'month' | 'threeMonths' | 'allTime'

const transactions = ref<Transaction[]>([])
const loading = ref(true)
const loadError = ref('')
const selectedRange = ref<RangeOption>('month')

function formatDateForApi(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function computeRange(option: RangeOption): { startDate: string | undefined; endDate: string } {
  const end = new Date()

  if (option === 'allTime') {
    // No startDate - the Api resolves this to the user's real earliest transaction date.
    return { startDate: undefined, endDate: formatDateForApi(end) }
  }

  const start = new Date(end)
  switch (option) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'threeMonths':
      start.setMonth(start.getMonth() - 3)
      break
  }

  return { startDate: formatDateForApi(start), endDate: formatDateForApi(end) }
}

function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

function formatAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '−'
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function fetchTransactions() {
  loading.value = true
  loadError.value = ''
  try {
    const { startDate, endDate } = computeRange(selectedRange.value)
    transactions.value = await getTransactions(startDate, endDate)
  } catch {
    loadError.value = 'Could not load transactions. Please try again later.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchTransactions)
watch(selectedRange, fetchTransactions)
</script>

<template>
  <div class="transactions-page">
    <div class="page-head">
      <h1>Transactions</h1>
      <p class="subtitle">Review transactions imported from your bank statements.</p>
    </div>

    <div class="filter-bar">
      <select v-model="selectedRange" aria-label="Date range">
        <option value="week">Last week</option>
        <option value="month">Last month</option>
        <option value="threeMonths">Last 3 months</option>
        <option value="allTime">All time</option>
      </select>
      <RouterLink to="/transactions/upload" class="upload-button">Upload</RouterLink>
    </div>

    <p v-if="loading" class="status">Loading transactions…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>
    <p v-else-if="transactions.length === 0" class="status">No transactions in this range.</p>

    <div v-else class="table-card">
      <table class="tx">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Account</th>
            <th class="num">Amount</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, index) in transactions" :key="index">
            <td class="date">{{ formatDisplayDate(t.date) }}</td>
            <td class="desc">{{ t.description }}</td>
            <td><span class="acct-badge">{{ t.account }}</span></td>
            <td :class="['amount', { pos: t.amount > 0 }]">{{ formatAmount(t.amount) }}</td>
            <td>
              <span v-if="t.category" class="chip">{{ t.category }}</span>
              <span v-else class="chip chip-muted">Uncategorized</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.transactions-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.transactions-page h1 {
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.upload-button {
  margin-left: auto;
  display: inline-block;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 500;
  text-decoration: none;
}

.upload-button:hover,
.upload-button:focus-visible {
  filter: brightness(0.94);
}

.table-card {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow-x: auto;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -12px rgba(0, 0, 0, 0.1);
}

table.tx {
  width: 100%;
  border-collapse: collapse;
}

table.tx thead th {
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  padding: 12px 16px;
  background: var(--field-bg);
  border-bottom: 1px solid var(--border);
}

table.tx td {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13.5px;
  color: var(--text-h);
}

table.tx tbody tr:last-child td {
  border-bottom: none;
}

table.tx td.date {
  color: var(--text);
  white-space: nowrap;
}

table.tx td.amount {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

table.tx td.amount.pos {
  color: #0ca30c;
}

th.num {
  text-align: right;
}

.acct-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  background: var(--field-bg);
  border: 1px solid var(--border);
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  color: var(--text-h);
  background: var(--field-bg);
  white-space: nowrap;
}

.chip-muted {
  border: 1px dashed var(--text);
  color: var(--text);
  background: none;
}
</style>
