<script setup lang="ts">
import { computed } from 'vue'
import type { MonthlyFlow } from '../utils/dashboardMetrics'

const props = defineProps<{
  data: MonthlyFlow[]
}>()

// Ported from docs/design/dashboard-mockup-calm.html's buildBars() - grouped bar geometry, with
// --s1 (income) / --s2 (expenses) as the bar colours.
const INCOME_COLOR = '#2a78d6'
const EXPENSE_COLOR = '#eb6834'

const W = 520
const H = 200
const PAD_L = 40
const PAD_R = 10
const PAD_T = 10
const PAD_B = 28
const PLOT_W = W - PAD_L - PAD_R
const PLOT_H = H - PAD_T - PAD_B
const BAR_W = 20
const BAR_GAP = 3
const CORNER_RADIUS = 5

function barPath(x: number, yBase: number, yTop: number, w: number, r: number): string {
  const h = yBase - yTop
  if (h <= 0) return ''
  const radius = Math.min(r, w / 2, h)
  return `M ${x} ${yBase} L ${x} ${yTop + radius} Q ${x} ${yTop} ${x + radius} ${yTop} L ${x + w - radius} ${yTop} Q ${x + w} ${yTop} ${x + w} ${yTop + radius} L ${x + w} ${yBase} Z`
}

// Rounds the axis max up to a "nice" 1/2/5 x 10^n value so gridlines land on tidy numbers.
function niceMax(value: number): number {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return niceNormalized * magnitude
}

const maxVal = computed(() => niceMax(Math.max(0, ...props.data.flatMap((d) => [d.income, d.expense]))))

const hasData = computed(() => props.data.some((d) => d.income !== 0 || d.expense !== 0))

interface GridLine {
  y: number
  label: string
}

const gridLines = computed<GridLine[]>(() => {
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = (maxVal.value / steps) * i
    return {
      y: PAD_T + PLOT_H - (value / maxVal.value) * PLOT_H,
      label: value === 0 ? '0' : `${(value / 1000).toLocaleString()}k`,
    }
  })
})

interface BarGroup {
  key: string
  label: string
  incomePath: string
  expensePath: string
  income: number
  expense: number
  labelX: number
}

const groups = computed<BarGroup[]>(() => {
  const groupW = PLOT_W / (props.data.length || 1)
  const yBase = PAD_T + PLOT_H

  return props.data.map((d, index) => {
    const centerX = PAD_L + index * groupW + groupW / 2
    const incomeX = centerX - BAR_GAP / 2 - BAR_W
    const expenseX = centerX + BAR_GAP / 2
    const incomeY = PAD_T + PLOT_H - (d.income / maxVal.value) * PLOT_H
    const expenseY = PAD_T + PLOT_H - (d.expense / maxVal.value) * PLOT_H

    return {
      key: `${d.month}-${d.year}`,
      label: d.month,
      incomePath: barPath(incomeX, yBase, incomeY, BAR_W, CORNER_RADIUS),
      expensePath: barPath(expenseX, yBase, expenseY, BAR_W, CORNER_RADIUS),
      income: d.income,
      expense: d.expense,
      labelX: centerX,
    }
  })
})

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}
</script>

<template>
  <div class="bar-chart-wrap">
    <div class="bar-legend">
      <div class="item"><span class="swatch" :style="{ background: INCOME_COLOR }"></span>Income</div>
      <div class="item"><span class="swatch" :style="{ background: EXPENSE_COLOR }"></span>Expenses</div>
    </div>

    <svg
      v-if="hasData"
      width="100%"
      height="200"
      viewBox="0 0 520 200"
      preserveAspectRatio="xMidYMid meet"
      class="bar-chart"
    >
      <g v-for="line in gridLines" :key="line.y">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="line.y" :y2="line.y" class="gridline" />
        <text :x="PAD_L - 8" :y="line.y + 3" text-anchor="end" class="axis-label">{{ line.label }}</text>
      </g>

      <template v-for="group in groups" :key="group.key">
        <path v-if="group.incomePath" :d="group.incomePath" :fill="INCOME_COLOR" class="bar-seg">
          <title>{{ group.label }} income {{ formatCurrency(group.income) }}</title>
        </path>
        <path v-if="group.expensePath" :d="group.expensePath" :fill="EXPENSE_COLOR" class="bar-seg">
          <title>{{ group.label }} expenses {{ formatCurrency(group.expense) }}</title>
        </path>
        <text :x="group.labelX" :y="H - 8" text-anchor="middle" class="month-label">{{ group.label }}</text>
      </template>
    </svg>
    <p v-else class="empty">No income or expenses in the last 6 months.</p>
  </div>
</template>

<style scoped>
.bar-chart-wrap {
  display: flex;
  flex-direction: column;
}

.bar-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.bar-legend .item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text);
  font-weight: 600;
}

.bar-legend .swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.bar-chart {
  overflow: visible;
}

.gridline {
  stroke: var(--border);
  stroke-width: 1;
}

.axis-label {
  font-size: 10px;
  fill: var(--text);
}

.month-label {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-h);
}

.bar-seg {
  cursor: pointer;
  transition: opacity 0.1s ease;
}

.bar-seg:hover {
  opacity: 0.82;
}

.empty {
  color: var(--text);
  font-size: 13px;
  padding: 40px 0;
}
</style>
