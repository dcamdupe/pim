<script setup lang="ts">
import type { Transaction } from '../services/transactionsService'
import { categoryColor } from '../constants/categories'
import { MONTH_ABBREVIATIONS } from '../utils/dashboardMetrics'

defineProps<{
  transactions: Transaction[]
}>()

const FALLBACK_COLOR = '#9093a3'

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.substring(0, 2), 16)
  const g = parseInt(value.substring(2, 4), 16)
  const b = parseInt(value.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function displayName(category: string): string {
  return category || 'Uncategorized'
}

function avatarInitial(description: string): string {
  return description.trim().charAt(0).toUpperCase() || '?'
}

function avatarStyle(category: string): { background: string } {
  return { background: category ? hexToRgba(categoryColor(category) ?? FALLBACK_COLOR, 0.16) : 'var(--border)' }
}

function formatDisplayDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day} ${MONTH_ABBREVIATIONS[Number(month) - 1]}`
}

function formatAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '−'
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="recent-list">
    <div v-for="(t, index) in transactions" :key="index" class="recent-row">
      <div class="r-avatar" :style="avatarStyle(t.category)">{{ avatarInitial(t.description) }}</div>
      <div class="r-main">
        <div class="r-desc">{{ t.description }}</div>
        <div class="r-meta">{{ formatDisplayDate(t.date) }} · {{ t.account }}</div>
      </div>
      <div class="r-cat">
        <span v-if="t.category" class="chip">
          <span class="dot" :style="{ background: categoryColor(t.category) ?? FALLBACK_COLOR }"></span>
          {{ displayName(t.category) }}
        </span>
        <span v-else class="chip chip-muted">Uncategorized</span>
      </div>
      <div class="r-amount" :class="{ pos: t.amount > 0 }">{{ formatAmount(t.amount) }}</div>
    </div>
    <p v-if="transactions.length === 0" class="empty">No transactions yet.</p>
  </div>
</template>

<style scoped>
.recent-list {
  display: flex;
  flex-direction: column;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border);
}

.recent-row:last-child {
  border-bottom: none;
}

.r-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 13px;
  color: var(--text-h);
}

.r-main {
  flex: 1;
  min-width: 0;
}

.r-desc {
  font-weight: 600;
  font-size: 13.5px;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-meta {
  font-size: 11.5px;
  color: var(--text);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-cat {
  flex: 0 0 auto;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  color: var(--text);
  white-space: nowrap;
  border: 1px solid var(--border);
}

.chip-muted {
  border-style: dashed;
}

.chip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.r-amount {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-weight: 700;
  font-size: 13.5px;
  text-align: right;
  min-width: 88px;
  color: var(--text-h);
}

.r-amount.pos {
  color: #0ca30c;
}

.empty {
  color: var(--text);
  font-size: 13px;
  padding: 20px 0;
}

@media (max-width: 560px) {
  .r-cat {
    display: none;
  }

  .r-amount {
    min-width: auto;
  }
}
</style>
