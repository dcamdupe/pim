<script setup lang="ts">
import { ref, computed } from 'vue'

interface MonthSpend {
  label: string
  amount: number
}

interface CategorySpend {
  label: string
  amount: number
}

interface Transaction {
  date: string
  description: string
  category: string
  amount: number
}

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
const compactCurrency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  notation: 'compact',
  maximumFractionDigits: 1,
})
function formatAmount(value: number): string {
  return currency.format(value)
}

// --- Mock data (placeholder only - not wired to the API yet) ---

const totalBalance = 8420.36
const monthlyIncome = 5200
const monthlyExpenses = 2480.14

const spendOverTime: MonthSpend[] = [
  { label: 'Feb', amount: 2150 },
  { label: 'Mar', amount: 1980 },
  { label: 'Apr', amount: 2340 },
  { label: 'May', amount: 2100 },
  { label: 'Jun', amount: 2470 },
  { label: 'Jul', amount: 2480 },
]

const spendByCategory: CategorySpend[] = [
  { label: 'Groceries', amount: 680 },
  { label: 'Dining', amount: 420 },
  { label: 'Transport', amount: 310 },
  { label: 'Utilities', amount: 260 },
  { label: 'Fun', amount: 180 },
]

const transactions: Transaction[] = [
  { date: '2026-07-26', description: 'Coles Supermarket', category: 'Groceries', amount: -84.32 },
  { date: '2026-07-25', description: 'Salary - Acme Pty Ltd', category: 'Income', amount: 2600 },
  { date: '2026-07-24', description: 'Netflix', category: 'Fun', amount: -22.99 },
  { date: '2026-07-23', description: 'Origin Energy', category: 'Utilities', amount: -145.6 },
  { date: '2026-07-22', description: 'Uber', category: 'Transport', amount: -18.5 },
  { date: '2026-07-21', description: 'The Local Bistro', category: 'Dining', amount: -64.0 },
  { date: '2026-07-20', description: 'Woolworths', category: 'Groceries', amount: -52.1 },
  { date: '2026-07-19', description: 'Refund - JB Hi-Fi', category: 'Fun', amount: 39.0 },
]

// --- Chart geometry (line/area: "Spending over time") ---

const lineChart = { width: 400, height: 220, padLeft: 44, padRight: 12, padTop: 16, padBottom: 28 }

const lineDomainMax = computed(() => {
  const max = Math.max(...spendOverTime.map((m) => m.amount))
  return Math.ceil(max / 500) * 500
})

const linePlot = computed(() => {
  const { width, height, padLeft, padRight, padTop, padBottom } = lineChart
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom
  const stepX = plotWidth / (spendOverTime.length - 1)
  const yFor = (amount: number) => padTop + plotHeight * (1 - amount / lineDomainMax.value)

  const points = spendOverTime.map((m, i) => ({
    x: padLeft + i * stepX,
    y: yFor(m.amount),
    label: m.label,
    amount: m.amount,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${padTop + plotHeight} L${points[0].x},${padTop + plotHeight} Z`

  const ticks = [0, 0.5, 1].map((t) => ({
    y: padTop + plotHeight * (1 - t),
    value: Math.round((lineDomainMax.value * t) / 100) * 100,
  }))

  return { points, linePath, areaPath, ticks, plotTop: padTop, plotBottom: padTop + plotHeight }
})

const hoveredMonthIndex = ref<number | null>(null)

function handleLineChartMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const scaleX = lineChart.width / rect.width
  const pointerX = (event.clientX - rect.left) * scaleX

  let closest = 0
  let closestDistance = Infinity
  linePlot.value.points.forEach((p, i) => {
    const distance = Math.abs(p.x - pointerX)
    if (distance < closestDistance) {
      closestDistance = distance
      closest = i
    }
  })
  hoveredMonthIndex.value = closest
}

function handleLineChartLeave() {
  hoveredMonthIndex.value = null
}

// --- Chart geometry (bar/column: "Spending by category") ---

const barChart = { width: 400, height: 220, padLeft: 44, padRight: 12, padTop: 24, padBottom: 28 }

const barDomainMax = computed(() => {
  const max = Math.max(...spendByCategory.map((c) => c.amount))
  return Math.ceil(max / 200) * 200
})

const barPlot = computed(() => {
  const { width, height, padLeft, padRight, padTop, padBottom } = barChart
  const plotWidth = width - padLeft - padRight
  const plotHeight = height - padTop - padBottom
  const bandWidth = plotWidth / spendByCategory.length
  const barWidth = Math.min(24, bandWidth * 0.55)

  const bars = spendByCategory.map((c, i) => {
    const barHeight = plotHeight * (c.amount / barDomainMax.value)
    return {
      x: padLeft + bandWidth * i + (bandWidth - barWidth) / 2,
      y: padTop + plotHeight - barHeight,
      width: barWidth,
      height: barHeight,
      hitX: padLeft + bandWidth * i,
      hitWidth: bandWidth,
      labelX: padLeft + bandWidth * i + bandWidth / 2,
      category: c.label,
      amount: c.amount,
    }
  })

  const ticks = [0, 0.5, 1].map((t) => ({
    y: padTop + plotHeight * (1 - t),
    value: Math.round((barDomainMax.value * t) / 100) * 100,
  }))

  return { bars, ticks, plotTop: padTop, plotBottom: padTop + plotHeight }
})

const hoveredCategoryIndex = ref<number | null>(null)

// --- Table-view toggles (accessibility twin of each chart) ---

const showLineTable = ref(false)
const showBarTable = ref(false)
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-header">
      <h1>Dashboard</h1>
      <p class="subtitle">Here's where your money's been going.</p>
    </header>

    <section class="stat-row" aria-label="Account summary">
      <div class="stat-tile">
        <span class="stat-label">Total balance</span>
        <span class="stat-value">{{ formatAmount(totalBalance) }}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">Income this month</span>
        <span class="stat-value">{{ formatAmount(monthlyIncome) }}</span>
        <span class="stat-delta stat-delta-good">↑ 4.2% vs last month</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">Expenses this month</span>
        <span class="stat-value">{{ formatAmount(monthlyExpenses) }}</span>
        <span class="stat-delta stat-delta-bad">↑ 8.1% vs last month</span>
      </div>
    </section>

    <section class="chart-row">
      <figure class="chart-card">
        <figcaption>
          <h2>Spending over time</h2>
          <button type="button" class="table-toggle" @click="showLineTable = !showLineTable">
            {{ showLineTable ? 'View chart' : 'View as table' }}
          </button>
        </figcaption>

        <table v-if="showLineTable" class="chart-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Spent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in spendOverTime" :key="m.label">
              <td>{{ m.label }}</td>
              <td class="num">{{ formatAmount(m.amount) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="chart-svg-wrap">
          <svg
            :viewBox="`0 0 ${lineChart.width} ${lineChart.height}`"
            role="img"
            aria-label="Total spending for each of the last six months"
            @mousemove="handleLineChartMove"
            @mouseleave="handleLineChartLeave"
          >
            <line
              v-for="tick in linePlot.ticks"
              :key="tick.value"
              class="gridline"
              :x1="lineChart.padLeft"
              :x2="lineChart.width - lineChart.padRight"
              :y1="tick.y"
              :y2="tick.y"
            />
            <text
              v-for="tick in linePlot.ticks"
              :key="`label-${tick.value}`"
              class="axis-label"
              :x="lineChart.padLeft - 6"
              :y="tick.y"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ compactCurrency.format(tick.value) }}
            </text>

            <path class="area" :d="linePlot.areaPath" />
            <path class="line" :d="linePlot.linePath" />

            <text
              v-for="p in linePlot.points"
              :key="`month-${p.label}`"
              class="axis-label"
              :x="p.x"
              :y="lineChart.height - 8"
              text-anchor="middle"
            >
              {{ p.label }}
            </text>

            <circle
              v-if="hoveredMonthIndex === null"
              class="end-dot"
              :cx="linePlot.points[linePlot.points.length - 1].x"
              :cy="linePlot.points[linePlot.points.length - 1].y"
              r="4"
            />
            <text
              v-if="hoveredMonthIndex === null"
              class="end-label"
              :x="linePlot.points[linePlot.points.length - 1].x"
              :y="linePlot.points[linePlot.points.length - 1].y - 10"
              text-anchor="end"
            >
              {{ formatAmount(linePlot.points[linePlot.points.length - 1].amount) }}
            </text>

            <template v-if="hoveredMonthIndex !== null">
              <line
                class="crosshair"
                :x1="linePlot.points[hoveredMonthIndex].x"
                :x2="linePlot.points[hoveredMonthIndex].x"
                :y1="linePlot.plotTop"
                :y2="linePlot.plotBottom"
              />
              <circle
                class="end-dot"
                :cx="linePlot.points[hoveredMonthIndex].x"
                :cy="linePlot.points[hoveredMonthIndex].y"
                r="5"
              />
            </template>
          </svg>

          <div
            v-if="hoveredMonthIndex !== null"
            class="tooltip"
            :style="{
              left: `${(linePlot.points[hoveredMonthIndex].x / lineChart.width) * 100}%`,
              top: `${(linePlot.points[hoveredMonthIndex].y / lineChart.height) * 100}%`,
            }"
          >
            <span class="tooltip-value">{{ formatAmount(linePlot.points[hoveredMonthIndex].amount) }}</span>
            <span class="tooltip-label">{{ linePlot.points[hoveredMonthIndex].label }}</span>
          </div>
        </div>
      </figure>

      <figure class="chart-card">
        <figcaption>
          <h2>Spending by category</h2>
          <button type="button" class="table-toggle" @click="showBarTable = !showBarTable">
            {{ showBarTable ? 'View chart' : 'View as table' }}
          </button>
        </figcaption>

        <table v-if="showBarTable" class="chart-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Spent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in spendByCategory" :key="c.label">
              <td>{{ c.label }}</td>
              <td class="num">{{ formatAmount(c.amount) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-else class="chart-svg-wrap">
          <svg
            :viewBox="`0 0 ${barChart.width} ${barChart.height}`"
            role="img"
            aria-label="Amount spent this month in each category"
          >
            <line
              v-for="tick in barPlot.ticks"
              :key="tick.value"
              class="gridline"
              :x1="barChart.padLeft"
              :x2="barChart.width - barChart.padRight"
              :y1="tick.y"
              :y2="tick.y"
            />
            <text
              v-for="tick in barPlot.ticks"
              :key="`label-${tick.value}`"
              class="axis-label"
              :x="barChart.padLeft - 6"
              :y="tick.y"
              text-anchor="end"
              dominant-baseline="middle"
            >
              {{ compactCurrency.format(tick.value) }}
            </text>

            <g v-for="(bar, i) in barPlot.bars" :key="bar.category">
              <text class="bar-value" :x="bar.labelX" :y="bar.y - 6" text-anchor="middle">
                {{ compactCurrency.format(bar.amount) }}
              </text>
              <rect
                class="bar"
                :class="{ 'bar-hovered': hoveredCategoryIndex === i }"
                :x="bar.x"
                :y="bar.y"
                :width="bar.width"
                :height="bar.height"
                rx="4"
              />
              <text class="axis-label" :x="bar.labelX" :y="barChart.height - 8" text-anchor="middle">
                {{ bar.category }}
              </text>
              <rect
                class="bar-hit"
                :x="bar.hitX"
                :y="barPlot.plotTop"
                :width="bar.hitWidth"
                :height="barPlot.plotBottom - barPlot.plotTop"
                @mouseenter="hoveredCategoryIndex = i"
                @mouseleave="hoveredCategoryIndex = null"
              />
            </g>
          </svg>

          <div
            v-if="hoveredCategoryIndex !== null"
            class="tooltip"
            :style="{
              left: `${(barPlot.bars[hoveredCategoryIndex].labelX / barChart.width) * 100}%`,
              top: `${(barPlot.bars[hoveredCategoryIndex].y / barChart.height) * 100}%`,
            }"
          >
            <span class="tooltip-value">{{ formatAmount(barPlot.bars[hoveredCategoryIndex].amount) }}</span>
            <span class="tooltip-label">{{ barPlot.bars[hoveredCategoryIndex].category }}</span>
          </div>
        </div>
      </figure>
    </section>

    <section class="transactions">
      <h2>Recent transactions</h2>
      <table class="transactions-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col" class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in transactions" :key="`${t.date}-${t.description}`">
            <td class="muted">{{ t.date }}</td>
            <td>{{ t.description }}</td>
            <td><span class="category-pill">{{ t.category }}</span></td>
            <td class="num" :class="t.amount > 0 ? 'amount-positive' : 'amount-negative'">
              {{ t.amount > 0 ? '+' : '' }}{{ formatAmount(t.amount) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.dashboard-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 64px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.dashboard-header h1 {
  margin: 0 0 4px;
}

.subtitle {
  margin: 0;
  color: var(--text);
}

/* Stat tiles */

.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
}

.stat-label {
  font-size: 13px;
  color: var(--text);
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: var(--text-h);
}

.stat-delta {
  font-size: 12px;
}

.stat-delta-good {
  color: #0ca30c;
}

.stat-delta-bad {
  color: var(--text);
}

/* Charts */

.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.chart-card {
  margin: 0;
  padding: 18px 20px 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
}

.chart-card figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.chart-card h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-h);
}

.table-toggle {
  font: inherit;
  font-size: 12px;
  color: var(--text);
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 3px 8px;
  cursor: pointer;
}

.table-toggle:hover {
  color: var(--text-h);
  border-color: var(--text);
}

.chart-svg-wrap {
  position: relative;
}

.chart-svg-wrap svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
}

.gridline {
  stroke: var(--border);
  stroke-width: 1;
}

.axis-label {
  fill: var(--text);
  font-size: 9px;
}

.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.area {
  fill: var(--accent);
  opacity: 0.1;
  stroke: none;
}

.end-dot {
  fill: var(--accent);
  stroke: var(--bg);
  stroke-width: 2;
}

.end-label {
  fill: var(--text-h);
  font-size: 11px;
  font-weight: 600;
}

.crosshair {
  stroke: var(--text);
  stroke-width: 1;
  opacity: 0.35;
}

.bar {
  fill: var(--accent);
  transition: opacity 0.1s ease;
}

.bar-hovered {
  opacity: 0.8;
}

.bar-value {
  fill: var(--text-h);
  font-size: 10px;
  font-weight: 600;
}

.bar-hit {
  fill: transparent;
  cursor: pointer;
}

.tooltip {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.tooltip-label {
  font-size: 11px;
  color: var(--text);
}

.chart-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.chart-table th,
.chart-table td {
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px solid var(--border);
}

/* Transactions */

.transactions h2 {
  font-size: 16px;
  margin: 0 0 12px;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.transactions-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  padding: 0 8px 8px;
  border-bottom: 1px solid var(--border);
}

.transactions-table td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
  color: var(--text-h);
}

.transactions-table .muted {
  color: var(--text);
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.category-pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text);
}

.amount-positive {
  color: #0ca30c;
}

.amount-negative {
  color: var(--text-h);
}
</style>
