<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryExpense } from '../utils/dashboardMetrics'

const props = withDefaults(
  defineProps<{
    expenses: CategoryExpense[]
    centerValue: string
    centerLabel?: string
  }>(),
  {
    centerLabel: 'this month',
  },
)

// Ported from docs/design/dashboard-mockup-calm.html's buildDoughnut() arc math.
const CX = 84
const CY = 84
const R = 64
const THICKNESS = 24
const GAP = 2.6
const FALLBACK_COLOR = '#9093a3'

function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const a = ((angle - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polar(cx, cy, r, end)
  const e = polar(cx, cy, r, start)
  const large = end - start <= 180 ? 0 : 1
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`
}

interface DoughnutSegment {
  category: string
  amount: number
  pct: number
  color: string
  path: string
}

const segments = computed<DoughnutSegment[]>(() => {
  let acc = 0
  return props.expenses.map((e) => {
    const sweep = e.pct * 3.6
    const start = acc + GAP / 2
    const end = acc + sweep - GAP / 2
    acc += sweep
    return {
      category: e.category,
      amount: e.amount,
      pct: e.pct,
      color: e.color ?? FALLBACK_COLOR,
      path: arcPath(CX, CY, R, start, end),
    }
  })
})

function displayName(category: string): string {
  return category || 'Uncategorized'
}
</script>

<template>
  <div class="doughnut-wrap">
    <svg v-if="segments.length" width="168" height="168" viewBox="0 0 168 168" class="doughnut">
      <path
        v-for="seg in segments"
        :key="seg.category"
        :d="seg.path"
        :stroke="seg.color"
        :stroke-width="THICKNESS"
        stroke-linecap="round"
        fill="none"
        class="doughnut-seg"
      >
        <title>{{ displayName(seg.category) }} ${{ seg.amount.toLocaleString() }} · {{ Math.round(seg.pct) }}%</title>
      </path>
      <text x="84" y="82" text-anchor="middle" class="doughnut-center-value">{{ centerValue }}</text>
      <text x="84" y="100" text-anchor="middle" class="doughnut-center-label">{{ centerLabel }}</text>
    </svg>
    <p v-else class="empty">No expenses this month.</p>

    <div v-if="segments.length" class="legend">
      <div v-for="seg in segments" :key="seg.category" class="legend-row">
        <span class="swatch" :style="{ background: seg.color }"></span>
        <span class="lname">{{ displayName(seg.category) }}</span>
        <span class="lpct">{{ Math.round(seg.pct) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doughnut-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.doughnut-center-value {
  font-size: 21px;
  font-weight: 800;
  fill: var(--text-h);
}

.doughnut-center-label {
  font-size: 10.5px;
  font-weight: 600;
  fill: var(--text);
}

.doughnut-seg {
  cursor: pointer;
  transition: opacity 0.1s ease;
}

.doughnut-seg:hover {
  opacity: 0.82;
}

.empty {
  color: var(--text);
  font-size: 13px;
  padding: 40px 0;
}

.legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 18px;
  width: 100%;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.swatch {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex: 0 0 auto;
}

.legend-row .lname {
  color: var(--text);
  flex: 1;
}

.legend-row .lpct {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  color: var(--text-h);
  font-weight: 700;
}
</style>
