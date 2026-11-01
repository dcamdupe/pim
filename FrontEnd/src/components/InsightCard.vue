<script setup lang="ts">
import SpendSparkline from './SpendSparkline.vue'
import { formatPct, formatSigned, headline, type CalendarMonth, type CategoryInsight } from '../utils/spendingInsights'

// One flagged category in the "Spending more" / "Spending less" lists (UBE-118).
defineProps<{
  insight: CategoryInsight
  colour: string
  selected: CalendarMonth
  pressed: boolean
}>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="insight"
    :aria-pressed="pressed ? 'true' : 'false'"
    :data-testid="`insight-${insight.name}`"
    @click="$emit('select')"
  >
    <span class="swatch" :style="{ background: colour }"></span>
    <span class="body">
      <span class="line1">
        <span class="cat">{{ insight.name }}</span>
        <span class="pill" :class="insight.change > 0 ? 'up' : 'down'">
          {{ insight.ratio === null ? 'new' : formatPct(insight.ratio) }}
        </span>
        <span v-for="tag in insight.tags" :key="tag" class="pill tag">{{ tag }}</span>
      </span>
      <span class="headline">{{ headline(insight, selected) }}</span>
    </span>
    <span class="right">
      <SpendSparkline :values="insight.spend" :colour="colour" />
      <span class="amount num">{{ formatSigned(insight.change) }}</span>
    </span>
  </button>
</template>

<style scoped>
.insight {
  display: grid;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  gap: 0 14px;
  align-items: center;
  text-align: left;
  width: 100%;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 14px 12px 0;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.insight:hover {
  border-color: var(--text);
  filter: none;
}

.insight[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -12px rgba(0, 0, 0, 0.1);
}

.swatch {
  align-self: stretch;
  border-radius: 0 3px 3px 0;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.line1 {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.cat {
  font-weight: 650;
  color: var(--text-h);
}

.headline {
  color: var(--text-h);
  font-size: 13.5px;
}

.right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.amount {
  font-size: 12px;
}
</style>
