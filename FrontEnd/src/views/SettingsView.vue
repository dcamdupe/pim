<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getSettings, saveSettings, deleteAccount, type Account, type AccountType } from '../services/settingsService'

interface PendingRemoval {
  account: Account
  index: number
}

const accountTypes: AccountType[] = ['Credit', 'Transaction', 'Savings']

const accounts = ref<Account[]>([])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

const pendingRemoval = ref<PendingRemoval | null>(null)
const deleting = ref(false)
const deleteError = ref('')

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
    accounts.value = (await getSettings()).accounts
    isUnsaved.value = accounts.value.map(() => false)
  } catch {
    loadError.value = 'Could not load your accounts. Please try again later.'
  } finally {
    loading.value = false
  }
})

function addAccount() {
  accounts.value.push({ name: '', number: '', type: 'Transaction' })
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
    await deleteAccount(pending.account)
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
            <input :id="`name-${index}`" v-model="account.name" type="text" placeholder="Everyday" />
          </div>
          <div class="field">
            <label :for="`number-${index}`">Number</label>
            <input :id="`number-${index}`" v-model="account.number" type="text" placeholder="123456" />
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
  grid-template-columns: 2fr 2fr 1.3fr auto;
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
