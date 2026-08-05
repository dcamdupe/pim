<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  getSettings,
  saveSettings,
  deleteAccount,
  addCategory,
  deleteCategory,
  type Account,
  type AccountType,
  type CategoryDefinition,
  type CategoryType,
} from '../services/settingsService'
import { refreshCategories } from '../services/categoriesService'
import { COLOUR_PALETTE } from '../constants/colourPalette'

interface PendingRemoval {
  account: Account
  index: number
}

const INTERNAL_TRANSFER = 'Internal Transfer'
const accountTypes: AccountType[] = ['Credit', 'Transaction', 'Savings']
const categoryTypes: CategoryType[] = ['Income', 'Expense', 'Inactive']

const accounts = ref<Account[]>([])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const pendingRemoval = ref<PendingRemoval | null>(null)
const deleting = ref(false)
const deleteError = ref('')

const categories = ref<CategoryDefinition[]>([])
const newCategoryName = ref('')
const newCategoryColour = ref<string>(COLOUR_PALETTE[27]) // Blue 500 - a neutral, visible default swatch
const showColourPicker = ref(false)
const newCategoryType = ref<CategoryType>('Expense')
const addingCategory = ref(false)
const addCategoryError = ref('')

const pendingCategoryRemoval = ref<CategoryDefinition | null>(null)
const deletingCategory = ref(false)
const deleteCategoryError = ref('')

// Parallel to `accounts`, index-for-index - whether that row was added via "+ Add account" but
// never yet saved, in which case removing it is instant and local (nothing exists server-side to
// delete or confirm). Kept as a plain index-aligned array rather than e.g. a Set<Account> keyed on
// object identity, since Vue wraps pushed objects in a reactive Proxy - a raw object reference
// added to a Set would never match what's read back out of `accounts.value`.
const isUnsaved = ref<boolean[]>([])

const hasDuplicateNames = computed(() => {
  const names = accounts.value.map((a) => a.name.trim().toLowerCase()).filter((n) => n !== '')
  return new Set(names).size !== names.length
})

onMounted(async () => {
  try {
    const settings = await getSettings()
    accounts.value = settings.accounts
    isUnsaved.value = accounts.value.map(() => false)
    categories.value = settings.categories
  } catch {
    loadError.value = 'Could not load your accounts. Please try again later.'
  } finally {
    loading.value = false
  }
})

function addAccount() {
  accounts.value.push({ name: '', type: 'Transaction' })
  isUnsaved.value.push(true)
}

function removeAccount(index: number) {
  if (isUnsaved.value[index]) {
    accounts.value.splice(index, 1)
    isUnsaved.value.splice(index, 1)
    return
  }
  pendingRemoval.value = { account: accounts.value[index], index }
}

async function confirmRemoveAccount() {
  const pending = pendingRemoval.value
  if (!pending) {
    return
  }

  deleteError.value = ''
  deleting.value = true
  try {
    await deleteAccount(pending.account.name)
    accounts.value.splice(pending.index, 1)
    isUnsaved.value.splice(pending.index, 1)
    pendingRemoval.value = null
  } catch {
    deleteError.value = 'Could not remove the account. Please try again.'
  } finally {
    deleting.value = false
  }
}

function cancelRemoveAccount() {
  pendingRemoval.value = null
}

async function onSave() {
  saveError.value = ''
  saved.value = false
  saving.value = true
  try {
    await saveSettings(accounts.value)
    saved.value = true
    isUnsaved.value = accounts.value.map(() => false)
  } catch {
    saveError.value = 'Could not save your changes. Please try again.'
  } finally {
    saving.value = false
  }
}

const hasDuplicateCategoryName = computed(() =>
  categories.value.some((c) => c.name.trim().toLowerCase() === newCategoryName.value.trim().toLowerCase()),
)

async function onAddCategory() {
  addCategoryError.value = ''
  if (!newCategoryName.value.trim()) {
    addCategoryError.value = 'Category name is required.'
    return
  }
  if (hasDuplicateCategoryName.value) {
    addCategoryError.value = 'Category names must be unique.'
    return
  }

  const category: CategoryDefinition = {
    name: newCategoryName.value.trim(),
    colour: newCategoryColour.value,
    type: newCategoryType.value,
  }
  addingCategory.value = true
  try {
    await addCategory(category)
    categories.value.push(category)
    await refreshCategories()
    newCategoryName.value = ''
    newCategoryColour.value = COLOUR_PALETTE[27]
    newCategoryType.value = 'Expense'
  } catch {
    addCategoryError.value = 'Could not add the category. Please try again.'
  } finally {
    addingCategory.value = false
  }
}

function selectColour(colour: string) {
  newCategoryColour.value = colour
  showColourPicker.value = false
}

// Closes the dropdown once focus leaves the whole trigger+panel widget (not just the trigger
// itself) - relatedTarget is the element gaining focus, null when focus leaves the document/browser
// chrome entirely, in which case we also want to close.
function onColourFocusOut(event: FocusEvent) {
  const container = event.currentTarget as HTMLElement
  if (!container.contains(event.relatedTarget as Node | null)) {
    showColourPicker.value = false
  }
}

function removeCategory(category: CategoryDefinition) {
  pendingCategoryRemoval.value = category
}

async function confirmRemoveCategory() {
  const pending = pendingCategoryRemoval.value
  if (!pending) {
    return
  }

  deleteCategoryError.value = ''
  deletingCategory.value = true
  try {
    await deleteCategory(pending)
    categories.value = categories.value.filter((c) => c.name !== pending.name)
    await refreshCategories()
    pendingCategoryRemoval.value = null
  } catch {
    deleteCategoryError.value = 'Could not remove the category. Please try again.'
  } finally {
    deletingCategory.value = false
  }
}

function cancelRemoveCategory() {
  pendingCategoryRemoval.value = null
}
</script>

<template>
  <div class="settings-page">
    <h1>Settings</h1>
    <p class="subtitle">Manage the accounts linked to your profile.</p>

    <p v-if="loading" class="status">Loading accounts…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>

    <template v-else>
      <div class="accounts">
        <div v-for="(account, index) in accounts" :key="index" class="account-row">
          <div class="field">
            <label :for="`name-${index}`">Name</label>
            <input
              :id="`name-${index}`"
              v-model="account.name"
              type="text"
              placeholder="Everyday"
              :readonly="!isUnsaved[index]"
              :title="!isUnsaved[index] ? `An account's name can't be changed after it's saved.` : undefined"
            />
          </div>
          <div class="field">
            <label :for="`type-${index}`">Type</label>
            <select :id="`type-${index}`" v-model="account.type">
              <option v-for="type in accountTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
          <button type="button" class="remove-button" aria-label="Remove account" @click="removeAccount(index)">
            Remove
          </button>
        </div>

        <p v-if="accounts.length === 0" class="status">No accounts yet.</p>
      </div>

      <button type="button" class="add-button" @click="addAccount">+ Add account</button>

      <div class="save-row">
        <button type="button" class="save-button" :disabled="saving || hasDuplicateNames" @click="onSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="saved" class="status status-success">Saved.</p>
        <p v-if="hasDuplicateNames" class="status status-error">Account names must be unique.</p>
        <p v-else-if="saveError" class="status status-error">{{ saveError }}</p>
      </div>

      <h2>Categories</h2>
      <p class="subtitle">Manage the categories used to classify transactions.</p>

      <div class="categories">
        <div v-for="category in categories" :key="category.name" class="category-row">
          <span class="swatch" :style="{ background: category.colour }" aria-hidden="true"></span>
          <span class="category-name">{{ category.name }}</span>
          <span class="category-type">{{ category.type }}</span>
          <button
            type="button"
            class="remove-button"
            :aria-label="`Remove category ${category.name}`"
            :disabled="category.name === INTERNAL_TRANSFER"
            @click="removeCategory(category)"
          >
            Remove
          </button>
        </div>

        <p v-if="categories.length === 0" class="status empty-state">No categories yet.</p>
      </div>

      <div class="add-category-row">
        <div class="field">
          <label for="new-category-name">Name</label>
          <input id="new-category-name" v-model="newCategoryName" type="text" placeholder="Groceries" />
        </div>

        <div class="field colour-field" @focusout="onColourFocusOut">
          <label id="new-category-colour-label" for="new-category-colour-trigger">Colour</label>
          <div class="colour-select">
            <button
              id="new-category-colour-trigger"
              type="button"
              class="colour-trigger"
              :style="{ background: newCategoryColour }"
              aria-haspopup="listbox"
              :aria-expanded="showColourPicker"
              aria-labelledby="new-category-colour-label"
              @click="showColourPicker = !showColourPicker"
              @keydown.escape="showColourPicker = false"
            ></button>
            <div
              v-if="showColourPicker"
              class="colour-dropdown"
              role="listbox"
              aria-labelledby="new-category-colour-label"
            >
              <button
                v-for="colour in COLOUR_PALETTE"
                :key="colour"
                type="button"
                class="palette-swatch"
                :class="{ selected: newCategoryColour === colour }"
                :style="{ background: colour }"
                role="option"
                :aria-selected="newCategoryColour === colour"
                :aria-label="colour"
                @click="selectColour(colour)"
              ></button>
            </div>
          </div>
        </div>

        <div class="field">
          <label for="new-category-type">Type</label>
          <select id="new-category-type" v-model="newCategoryType">
            <option v-for="type in categoryTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>

        <button type="button" class="add-button" :disabled="addingCategory" @click="onAddCategory">
          {{ addingCategory ? 'Adding…' : '+ Add category' }}
        </button>
      </div>
      <p v-if="addCategoryError" class="status status-error">{{ addCategoryError }}</p>

      <div class="save-row">
        <button type="button" class="save-button" :disabled="saving || hasDuplicateNames" @click="onSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="saved" class="status status-success">Saved.</p>
        <p v-if="hasDuplicateNames" class="status status-error">Account names must be unique.</p>
        <p v-else-if="saveError" class="status status-error">{{ saveError }}</p>
      </div>
    </template>

    <div v-if="pendingRemoval" class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Delete account?</h2>
        <p>This will also delete all the transaction for this account? Do you want to delete the account?</p>
        <p v-if="deleteError" class="status status-error">{{ deleteError }}</p>
        <div class="modal-actions">
          <button type="button" class="modal-button secondary" :disabled="deleting" @click="cancelRemoveAccount">No</button>
          <button type="button" class="modal-button danger" :disabled="deleting" @click="confirmRemoveAccount">
            {{ deleting ? 'Deleting…' : 'Yes' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="pendingCategoryRemoval" class="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <h2>Delete category?</h2>
        <p>This will remove "{{ pendingCategoryRemoval.name }}" from all transactions. Do you want to delete the category?</p>
        <p v-if="deleteCategoryError" class="status status-error">{{ deleteCategoryError }}</p>
        <div class="modal-actions">
          <button type="button" class="modal-button secondary" :disabled="deletingCategory" @click="cancelRemoveCategory">
            No
          </button>
          <button type="button" class="modal-button danger" :disabled="deletingCategory" @click="confirmRemoveCategory">
            {{ deletingCategory ? 'Deleting…' : 'Yes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.settings-page h1 {
  margin: 0 0 4px;
}

.settings-page h2 {
  margin: 32px 0 4px;
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

.status-success {
  color: #0ca30c;
}

.accounts {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.account-row {
  display: grid;
  grid-template-columns: 2fr 1.3fr auto;
  gap: 12px;
  align-items: end;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field input:read-only {
  color: var(--text-h);
  background: var(--field-bg);
  cursor: not-allowed;
}

label {
  font-size: 13px;
  color: var(--text-h);
}

.remove-button,
.add-button {
  font-size: 13px;
  padding: 8px 12px;
  background: none;
  color: var(--text);
}

.remove-button {
  border: 1px solid var(--border);
}

.add-button {
  border: 1px dashed var(--border);
  margin-bottom: 24px;
}

.remove-button:hover:not(:disabled),
.add-button:hover:not(:disabled) {
  color: var(--text-h);
  border-color: var(--text);
  filter: none;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.categories {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
  margin-bottom: 16px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.empty-state {
  grid-column: 1 / -1;
}

.swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.category-name {
  flex: 1;
  color: var(--text);
}

.category-type {
  font-size: 12px;
  color: var(--text-h);
}

.add-category-row {
  display: flex;
  align-items: end;
  gap: 12px;
  margin-bottom: 8px;
}

.add-category-row .add-button {
  border: 1px dashed var(--border);
  margin-bottom: 0;
}

.colour-select {
  position: relative;
}

.colour-trigger {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  padding: 0;
  cursor: pointer;
}

.colour-dropdown {
  position: absolute;
  z-index: 10;
  top: calc(100% + 6px);
  left: 0;
  display: grid;
  grid-template-columns: repeat(10, 20px);
  gap: 6px;
  padding: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.35);
}

.palette-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  padding: 0;
  cursor: pointer;
}

.palette-swatch.selected {
  border-color: var(--text-h);
  box-shadow: 0 0 0 2px var(--bg);
  outline: 1px solid var(--text-h);
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

.modal-button.danger {
  background: #d33;
  color: #fff;
  border-color: transparent;
}
</style>
