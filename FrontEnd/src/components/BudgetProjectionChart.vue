<script setup lang="ts">
import { computed } from 'vue'
import type { BudgetProjection } from '../utils/budgetMetrics'

const props = defineProps<{
  projection: BudgetProjection
}>()

// Horizontal bar per budgeted category (UBE-124): solid = spent so far, light = projected rest of
// the month, vertical marker = budget.
const FALLBACK_COLOR = '#9093a3'

const scale = computed(() => Math.max(1, ...props.projection.rows.flatMap((r) => [r.budget, r.projected])))

function pct(value: number): string {
  return `${Math.min(100, (value / scale.value) * 100)}%`
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`
}
</script>

<template>
  <div class="projection">
    <div class="legend">
      <span class="item"><span class="swatch solid"></span>Spent</span>
      <span v-if="projection.isProjected" class="item"><span class="swatch light"></span>Projected</span>
      <span class="item"><span class="swatch marker"></span>Budget</span>
    </div>

    <div v-for="row in projection.rows" :key="row.category" class="row" :data-testid="`projection-${row.category}`">
      <div class="row-head">
        <span class="name">{{ row.category }}</span>
        <span class="values">
          {{ formatCurrency(projection.isProjected ? row.projected : row.actual) }}
          <span class="of">of {{ formatCurrency(row.budget) }}</span>
        </span>
      </div>
      <div class="track">
        <div
          v-if="projection.isProjected"
          class="bar projected"
          :style="{ width: pct(row.projected), background: row.color ?? FALLBACK_COLOR }"
        ></div>
        <div
          class="bar actual"
          :style="{ width: pct(row.actual), background: row.color ?? FALLBACK_COLOR }"
          :title="`${row.category} spent ${formatCurrency(row.actual)}`"
        ></div>
        <div class="budget-marker" :style="{ left: pct(row.budget) }" :title="`Budget ${formatCurrency(row.budget)}`"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
}

.legend .item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--text);
}

.swatch.light {
  opacity: 0.3;
}

.swatch.marker {
  width: 2px;
  height: 12px;
  border-radius: 0;
  background: var(--text-h);
}

.row-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 3px;
}

.name {
  color: var(--text-h);
  font-weight: 600;
}

.values {
  color: var(--text-h);
  font-variant-numeric: tabular-nums;
}

.of {
  color: var(--text);
  font-weight: 400;
}

.track {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: var(--field-bg);
}

.bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 5px;
}

.bar.projected {
  opacity: 0.3;
}

.budget-marker {
  position: absolute;
  top: -3px;
  width: 2px;
  height: 16px;
  margin-left: -1px;
  background: var(--text-h);
}
</style>
