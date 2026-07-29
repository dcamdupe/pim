<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getSettings, saveSettings, type Account, type AccountType } from '../services/settingsService'

const accountTypes: AccountType[] = ['Credit', 'Transaction', 'Savings']

const accounts = ref<Account[]>([])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')
const saved = ref(false)

onMounted(async () => {
  try {
    accounts.value = await getSettings()
  } catch {
    loadError.value = 'Could not load your accounts. Please try again later.'
  } finally {
    loading.value = false
  }
})

function addAccount() {
  accounts.value.push({ name: '', number: '', type: 'Transaction' })
}

function removeAccount(index: number) {
  accounts.value.splice(index, 1)
}

async function onSave() {
  saveError.value = ''
  saved.value = false
  saving.value = true
  try {
    await saveSettings(accounts.value)
    saved.value = true
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
        <button type="button" class="save-button" :disabled="saving" @click="onSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="saved" class="status status-success">Saved.</p>
        <p v-if="saveError" class="status status-error">{{ saveError }}</p>
      </div>
    </template>
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
</style>
