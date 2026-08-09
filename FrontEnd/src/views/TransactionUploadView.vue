<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { refreshTransactionDescriptions } from '../services/transactionDescriptionsService'
import { uploadTransactions } from '../services/transactionsService'
import { useTransactionsStore } from '../stores/transactions'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const transactionsStore = useTransactionsStore()
const settingsStore = useSettingsStore()
const { accounts } = storeToRefs(settingsStore)

const selectedAccount = ref('')
const file = ref<File | null>(null)
const isDragging = ref(false)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

onMounted(async () => {
  try {
    await settingsStore.load()
    selectedAccount.value = accounts.value[0]?.name ?? ''
  } catch {
    loadError.value = 'Could not load your accounts. Please try again later.'
  } finally {
    loading.value = false
  }
})

// The store's accounts can change under this view (e.g. the 1-minute background refresh) after the
// initial default was already picked - if the previously-selected account disappears (deleted
// elsewhere), fall back to the first remaining one rather than leaving a stale, now-invalid
// selection in the dropdown.
watch(accounts, (current) => {
  if (!current.some((a) => a.name === selectedAccount.value)) {
    selectedAccount.value = current[0]?.name ?? ''
  }
})

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const dropped = event.dataTransfer?.files?.[0]
  if (dropped) {
    file.value = dropped
  }
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function onSave() {
  if (!selectedAccount.value || !file.value) {
    return
  }

  saveError.value = ''
  saving.value = true
  try {
    await uploadTransactions(selectedAccount.value, file.value)
    // Both best-effort - the upload itself already succeeded, so a failure refreshing either
    // cache shouldn't surface as an upload error. The transactions store refresh is a forced
    // refresh() (not load()) since it needs to bypass the cache-freshness check - the newly
    // uploaded rows must show up on /transactions immediately, not wait out however much of the
    // expiry window happens to be left from an earlier, now-stale load elsewhere in the app.
    await Promise.all([refreshTransactionDescriptions().catch(() => {}), transactionsStore.refresh().catch(() => {})])
    router.push('/transactions')
  } catch {
    saveError.value = 'Could not upload the file. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="upload-page">
    <h1>Upload transactions</h1>
    <p class="subtitle">Select an account and upload a QIF bank statement.</p>

    <p v-if="loading" class="status">Loading accounts…</p>
    <p v-else-if="loadError" class="status status-error">{{ loadError }}</p>

    <template v-else>
      <div class="field">
        <label for="account">Account</label>
        <select id="account" v-model="selectedAccount">
          <option v-if="accounts.length === 0" value="" disabled>No accounts configured</option>
          <option v-for="account in accounts" :key="account.name" :value="account.name">{{ account.name }}</option>
        </select>
      </div>

      <label
        for="file-input"
        class="dropzone"
        :class="{ dragging: isDragging }"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <span v-if="file">{{ file.name }}</span>
        <span v-else>Drag a QIF file here, or click to browse</span>
      </label>
      <input id="file-input" type="file" accept=".qif" class="file-input" @change="onFileSelected" />

      <div class="save-row">
        <button type="button" class="save-button" :disabled="saving || !selectedAccount || !file" @click="onSave">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <p v-if="saveError" class="status status-error">{{ saveError }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.upload-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.upload-page h1 {
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

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
}

.field label {
  font-size: 13px;
  color: var(--text-h);
}

.dropzone {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px dashed var(--border);
  border-radius: 10px;
  color: var(--text);
  text-align: center;
  cursor: pointer;
}

.dropzone.dragging {
  border-color: var(--accent);
  color: var(--text-h);
}

.file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
