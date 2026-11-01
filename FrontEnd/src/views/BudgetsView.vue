<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getBudgets, saveBudgets, type Budget } from '../services/budgetsService'
import { useSettingsStore } from '../stores/settings'
import { formatBudgetInput, parseBudgetAmount, totalBudget } from '../utils/budgetAmounts'

// Recurring monthly budgets per Expense category (UBE-119). Tracking against them is a later ticket.
const settingsStore = useSettingsStore()

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')
// Raw input text per category name - blank means no budget.
const inputs = ref<Record<string, string>>({})

const expenseCategories = computed(() =>
  settingsStore.categories.filter((c) => c.type === 'Expense').sort((a, b) => a.name.localeCompare(b.name)),
)

const errors = computed(() => {
  const result: Record<string, string> = {}
  for (const category of expenseCategories.value) {
    const parsed = parseBudgetAmount(inputs.value[category.name] ?? '')
    if (parsed.kind === 'invalid') {
      result[category.name] = parsed.message
    }
  }
  return result
})

const hasErrors = computed(() => Object.keys(errors.value).length > 0)

const total = computed(() => totalBudget(expenseCategories.value.map((c) => inputs.value[c.name] ?? '')))

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function onInput() {
  saved.value = false
}

onMounted(async () => {
  try {
    const [budgets] = await Promise.all([getBudgets(), settingsStore.load()])
    inputs.value = Object.fromEntries(budgets.map((b) => [b.category, formatBudgetInput(b.amount)]))
  } catch {
    loadError.value = 'Could not load your budgets. Please try again later.'
  } finally {
    loading.value = false
  }
})

async function onSave() {
  if (hasErrors.value) {
    return
  }
  const budgets: Budget[] = []
  for (const category of expenseCategories.value) {
    const parsed = parseBudgetAmount(inputs.value[category.name] ?? '')
    if (parsed.kind === 'valid') {
      budgets.push({ category: category.name, amount: parsed.amount })
    }
  }

  saving.value = true
  saved.value = false
  saveError.value = ''
  try {
    await saveBudgets(budgets)
    saved.value = true
  } catch {
    saveError.value = 'Could not save your budgets. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="budgets-page">
    <h1>Budgets</h1>
    <p class="subtitle">Set a monthly budget for each expense category. Leave a category blank for no budget.</p>

    <p v-if="loading" class="status">Loading budgets…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>
    <p v-else-if="expenseCategories.length === 0" class="status">
      You have no expense categories yet. Add some in <RouterLink to="/settings">Settings</RouterLink>.
    </p>

    <template v-else>
      <div class="budget-list">
        <div v-for="category in expenseCategories" :key="category.name" class="budget-row">
          <label :for="`budget-${category.name}`" class="budget-category">
            <span class="swatch" :style="{ background: category.colour }"></span>
            {{ category.name }}
          </label>
          <div class="budget-input-wrap">
            <span class="currency">$</span>
            <input
              :id="`budget-${category.name}`"
              v-model="inputs[category.name]"
              class="budget-input"
              type="text"
              inputmode="decimal"
              placeholder="No budget"
              :aria-invalid="errors[category.name] ? 'true' : 'false'"
              :disabled="saving"
              @input="onInput"
            />
          </div>
          <p v-if="errors[category.name]" class="status status-error budget-error">{{ errors[category.name] }}</p>
        </div>
      </div>

      <div class="total-row">
        <span>Total monthly budget</span>
        <strong data-testid="budget-total">{{ formatCurrency(total) }}</strong>
      </div>

      <div class="save-row">
        <button type="button" class="save-button" :disabled="saving || hasErrors" @click="onSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="saved" class="status status-success">Saved.</p>
        <p v-else-if="saveError" class="status status-error">{{ saveError }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.budgets-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

.budgets-page h1 {
  margin: 0 0 4px;
}

.subtitle {
  margin: 0 0 14px;
  color: var(--text);
}

.status {
  margin: 0;
  color: var(--text);
}

.status-error {
  color: #d33;
}

.status-success {
  color: #0ca30c;
}

.budget-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.budget-row {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 2px 12px;
  align-items: center;
  padding: 4px 6px 4px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.budget-category {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--text-h);
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.budget-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.currency {
  color: var(--text);
}

.budget-input {
  width: 100%;
  min-width: 0;
  padding: 4px 8px;
  border-radius: 6px;
  text-align: right;
}

.budget-input[aria-invalid='true'] {
  border-color: #d33;
}

.budget-error {
  grid-column: 1 / -1;
  font-size: 13px;
  text-align: right;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 8px;
  border-top: 1px solid var(--border);
  color: var(--text-h);
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
