<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { categoryColor, categoryNames } from '../services/categoriesService'
import { getCachedTransactionDescriptions } from '../services/transactionDescriptionsService'
import { saveDescriptionMapping, type Transaction } from '../services/transactionsService'
import { useTransactionsStore } from '../stores/transactions'
import { findApproximateMatch, type ApproximateMatch } from '../utils/descriptionMatching'
import { filterTransactions } from '../utils/transactionFilters'
import { loadStoredTransactionFilters, saveTransactionFilters, type RangeOption } from '../utils/transactionFilterStorage'
import { filterByDateRange, pastSixMonthOptions } from '../utils/transactionDateRange'
import { nextVisibleCount, TRANSACTIONS_PAGE_SIZE } from '../utils/infiniteScroll'

interface PendingCategoryChange {
  transaction: Transaction
  category: string
  match: ApproximateMatch
}

const storedFilters = loadStoredTransactionFilters()
const CATEGORIES = categoryNames()
const PAST_SIX_MONTHS = pastSixMonthOptions(new Date())

const transactionsStore = useTransactionsStore()
const { transactions } = storeToRefs(transactionsStore)
const loading = ref(true)
const loadError = ref('')
const selectedRange = ref<RangeOption>(storedFilters?.range ?? 'month')
const pendingCategoryChange = ref<PendingCategoryChange | null>(null)
const savingCategory = ref(false)
const categorySaveError = ref('')

const searchQuery = ref(storedFilters?.search ?? '')
const selectedAccount = ref(storedFilters?.account ?? '')
const selectedCategory = ref(storedFilters?.category ?? '')
const needsCategoryOnly = ref(storedFilters?.needsCategoryOnly ?? false)

const openMenuIndex = ref<number | null>(null)
const togglingIgnore = ref(false)
const toggleIgnoreError = ref('')

const visibleCount = ref(TRANSACTIONS_PAGE_SIZE)
const scrollSentinel = ref<HTMLElement | null>(null)
let scrollObserver: IntersectionObserver | null = null

// Filtered by the selected date range only - re-derived from the shared store's full history on
// every read, so it stays in sync with background refreshes/updates without a fetch of its own.
const rangeFilteredTransactions = computed(() => filterByDateRange(transactions.value, selectedRange.value, new Date()))

const accountOptions = computed(() => [...new Set(rangeFilteredTransactions.value.map((t) => t.account))].sort())

// Search/account/category applied, but not the needs-category toggle - this is what the
// toggle's own count badge reflects, so it updates live as you type/pick a filter rather than
// only ever showing the count for the unfiltered range.
const searchedAndCategorised = computed(() =>
  filterTransactions(rangeFilteredTransactions.value, {
    search: searchQuery.value,
    account: selectedAccount.value,
    category: selectedCategory.value,
    needsCategoryOnly: false,
  }),
)
const needsCategoryCount = computed(() => searchedAndCategorised.value.filter((t) => !t.category).length)
const filteredTransactions = computed(() =>
  needsCategoryOnly.value ? searchedAndCategorised.value.filter((t) => !t.category) : searchedAndCategorised.value,
)
// Renders only the first page of the (already fully-loaded, single-API-call) filtered set - the
// scrollObserver below grows visibleCount as the sentinel after the table comes into view.
const visibleTransactions = computed(() => filteredTransactions.value.slice(0, visibleCount.value))

function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

function formatAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '−'
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function loadTransactions() {
  loading.value = true
  loadError.value = ''
  try {
    await transactionsStore.load()
  } catch {
    loadError.value = 'Could not load transactions. Please try again later.'
  } finally {
    loading.value = false
  }
}

async function applySingleCategory(transaction: Transaction, category: string) {
  categorySaveError.value = ''
  savingCategory.value = true
  try {
    await transactionsStore.updateTransaction(transaction, { category })
  } catch {
    categorySaveError.value = 'Could not save the category. Please try again.'
  } finally {
    savingCategory.value = false
  }
}

function onCategoryChange(transaction: Transaction, event: Event) {
  const category = (event.target as HTMLSelectElement).value
  const otherDescriptions = getCachedTransactionDescriptions()
  const match = findApproximateMatch(transaction.description, otherDescriptions)

  if (match) {
    pendingCategoryChange.value = { transaction, category, match }
  } else {
    void applySingleCategory(transaction, category)
  }
}

async function confirmBulkApply() {
  const pending = pendingCategoryChange.value
  if (!pending) {
    return
  }
  pendingCategoryChange.value = null

  categorySaveError.value = ''
  savingCategory.value = true
  try {
    await saveDescriptionMapping(pending.match.descriptionStart, pending.category)
    // A forced refresh, not load() - the mapping rule can retroactively recategorise many
    // transactions server-side that we have no individual references to mutate locally.
    await transactionsStore.refresh()
  } catch {
    categorySaveError.value = 'Could not save the category. Please try again.'
  } finally {
    savingCategory.value = false
  }
}

function declineBulkApply() {
  const pending = pendingCategoryChange.value
  if (!pending) {
    return
  }
  pendingCategoryChange.value = null
  void applySingleCategory(pending.transaction, pending.category)
}

function cancelCategoryChange() {
  pendingCategoryChange.value = null
}

function closeRowMenu() {
  openMenuIndex.value = null
}

async function toggleIgnore(transaction: Transaction) {
  openMenuIndex.value = null
  toggleIgnoreError.value = ''
  togglingIgnore.value = true
  try {
    await transactionsStore.updateTransaction(transaction, { ignore: !transaction.ignore })
  } catch {
    toggleIgnoreError.value = 'Could not update the transaction. Please try again.'
  } finally {
    togglingIgnore.value = false
  }
}

onMounted(() => {
  void loadTransactions()
  document.addEventListener('click', closeRowMenu)

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visibleCount.value = nextVisibleCount(visibleCount.value, filteredTransactions.value.length)
    }
  })
})
onUnmounted(() => {
  document.removeEventListener('click', closeRowMenu)
  scrollObserver?.disconnect()
})
watch(scrollSentinel, (el, previousEl) => {
  if (previousEl) {
    scrollObserver?.unobserve(previousEl)
  }
  if (el) {
    scrollObserver?.observe(el)
  }
})
watch([selectedRange, searchQuery, selectedAccount, selectedCategory, needsCategoryOnly], () => {
  visibleCount.value = TRANSACTIONS_PAGE_SIZE
  saveTransactionFilters({
    range: selectedRange.value,
    search: searchQuery.value,
    account: selectedAccount.value,
    category: selectedCategory.value,
    needsCategoryOnly: needsCategoryOnly.value,
  })
})
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
        <option v-for="m in PAST_SIX_MONTHS" :key="m.value" :value="m.value">{{ m.label }}</option>
        <option value="year">Last year</option>
        <option value="financialYear">Last financial year</option>
        <option value="allTime">All time</option>
      </select>
      <input v-model="searchQuery" type="search" placeholder="Search description…" aria-label="Search description" class="search-input" />
      <select v-model="selectedAccount" aria-label="Account filter">
        <option value="">All accounts</option>
        <option v-for="a in accountOptions" :key="a" :value="a">{{ a }}</option>
      </select>
      <select v-model="selectedCategory" aria-label="Category filter">
        <option value="">All categories</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
      <button
        type="button"
        class="chip-toggle"
        :class="{ active: needsCategoryOnly }"
        @click="needsCategoryOnly = !needsCategoryOnly"
      >
        <span class="chip-toggle-count">{{ needsCategoryCount }}</span> need a category
      </button>
      <RouterLink to="/transactions/upload" class="upload-button">Upload</RouterLink>
    </div>

    <p v-if="loading" class="status">Loading transactions…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>
    <p v-else-if="categorySaveError" class="status status-error">{{ categorySaveError }}</p>
    <p v-else-if="toggleIgnoreError" class="status status-error">{{ toggleIgnoreError }}</p>
    <p v-else-if="transactions.length === 0" class="status">No transactions in this range.</p>
    <p v-else-if="filteredTransactions.length === 0" class="status">No transactions match your filters.</p>

    <div v-else class="table-card">
      <table class="tx">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Account</th>
            <th class="num">Amount</th>
            <th>Category</th>
            <th class="actions-header"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, index) in visibleTransactions" :key="index" :class="{ 'row-ignore': t.ignore }">
            <td class="date">{{ formatDisplayDate(t.date) }}</td>
            <td class="desc">
              {{ t.description }}
              <span v-if="t.ignore" class="chip chip-muted">Ignore</span>
            </td>
            <td><span class="acct-badge">{{ t.account }}</span></td>
            <td :class="['amount', { pos: t.amount > 0 }]">{{ formatAmount(t.amount) }}</td>
            <td>
              <div class="category-cell">
                <span v-if="t.category" class="cat-dot" :style="{ background: categoryColor(t.category) }"></span>
                <select
                  class="category-select"
                  :class="{ needs: !t.category }"
                  :value="t.category"
                  :disabled="savingCategory"
                  @change="onCategoryChange(t, $event)"
                >
                  <option value="" disabled>+ Add category</option>
                  <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </td>
            <td class="actions">
              <div class="row-menu" @click.stop>
                <button
                  type="button"
                  class="row-menu-button"
                  aria-haspopup="menu"
                  :aria-label="`Actions for ${t.description}`"
                  @click="openMenuIndex = openMenuIndex === index ? null : index"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
                <div v-if="openMenuIndex === index" class="row-menu-popover" role="menu">
                  <button
                    type="button"
                    class="row-menu-item"
                    role="menuitem"
                    :disabled="togglingIgnore"
                    @click="toggleIgnore(t)"
                  >
                    {{ t.ignore ? 'Unignore' : 'Ignore' }}
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="visibleCount < filteredTransactions.length" ref="scrollSentinel" class="scroll-sentinel"></div>
    </div>

    <div v-if="pendingCategoryChange" class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Apply to similar transactions?</h2>
        <p>
          {{ pendingCategoryChange.match.matchingTransactionCount }}
          other transaction{{ pendingCategoryChange.match.matchingTransactionCount === 1 ? '' : 's' }}
          starting with "<strong>{{ pendingCategoryChange.match.descriptionStart }}</strong>" could also be categorised
          as <strong>{{ pendingCategoryChange.category }}</strong>.
        </p>
        <div class="modal-actions">
          <button type="button" class="modal-button secondary" @click="cancelCategoryChange">Cancel</button>
          <button type="button" class="modal-button secondary" @click="declineBulkApply">Just this one</button>
          <button type="button" class="modal-button primary" @click="confirmBulkApply">
            Apply to {{ pendingCategoryChange.match.matchingTransactionCount }} similar transactions
          </button>
        </div>
      </div>
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
  flex-wrap: wrap;
}

.search-input {
  min-width: 200px;
  flex: 1 1 200px;
}

.chip-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--field-bg);
  color: var(--text);
  font-weight: 600;
  font-size: 13px;
}

.chip-toggle-count {
  background: var(--text-h);
  color: var(--bg);
  border-radius: 20px;
  padding: 1px 7px;
  font-size: 11px;
}

.chip-toggle.active {
  background: var(--text-h);
  color: var(--bg);
  border-color: var(--text-h);
}

.chip-toggle.active .chip-toggle-count {
  background: rgba(255, 255, 255, 0.22);
  color: var(--bg);
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

table.tx tbody tr.row-ignore {
  opacity: 0.55;
}

td.actions,
th.actions-header {
  width: 1%;
  text-align: right;
}

.row-menu {
  position: relative;
  display: inline-block;
}

.row-menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 8px;
  background: none;
  color: var(--text);
}

.row-menu-button:hover,
.row-menu-button:focus-visible {
  background: var(--field-bg);
  color: var(--text-h);
  filter: none;
}

.row-menu-popover {
  position: absolute;
  top: 100%;
  right: 0;
  min-width: 130px;
  padding: 6px;
  margin-top: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  z-index: 20;
}

.row-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-h);
  font-size: 13px;
}

.row-menu-item:hover,
.row-menu-item:focus-visible {
  background: var(--field-bg);
  filter: none;
}

.category-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-select {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
  background: var(--field-bg);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 4px 10px;
}

.category-select.needs {
  border-style: dashed;
  color: var(--text);
}

.scroll-sentinel {
  height: 1px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 420px;
  box-shadow: 0 16px 48px -12px rgba(0, 0, 0, 0.35);
}

.modal h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.modal p {
  margin: 0 0 20px;
  color: var(--text-h);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-button {
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 500;
  border: 1px solid var(--border);
  cursor: pointer;
}

.modal-button.secondary {
  background: var(--field-bg);
  color: var(--text-h);
}

.modal-button.primary {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: transparent;
}
</style>
