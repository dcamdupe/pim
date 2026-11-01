<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  addMonths,
  formatMoney,
  formatPct,
  formatSigned,
  headline,
  monthKeyOf,
  monthName,
  sixMonthWindow,
  type CalendarMonth,
  type CategoryInsight,
  type Driver,
} from '../utils/spendingInsights'
import { MONTH_ABBREVIATIONS } from '../utils/dashboardMetrics'

// Detail panel for the selected category (UBE-118, mockup's renderDetail()/barChart()).
const props = defineProps<{
  insight: CategoryInsight
  drivers: Driver[]
  selected: CalendarMonth
}>()

const previous = computed(() => addMonths(props.selected, -1))
const monthsWindow = computed(() => sixMonthWindow(props.selected))
const changeClass = computed(() => (props.insight.change > 0 ? 'up' : props.insight.change < 0 ? 'down' : 'flat'))
const transactionsLink = computed(() => ({
  path: '/transactions',
  query: { range: `month:${monthKeyOf(props.selected)}`, category: props.insight.category },
}))

// Bar chart geometry from the mockup.
const W = 520
const H = 220
const L = 48
const R = 12
const T = 14
const B = 30

const chart = computed(() => {
  const spend = props.insight.spend
  const max = Math.max(...spend, props.insight.avg)
  const step = max > 4000 ? 1000 : max > 800 ? 250 : max > 400 ? 100 : 50
  const top = Math.ceil(max / step) * step || step
  const y = (v: number) => T + (H - T - B) * (1 - v / top)
  const slot = (W - L - R) / spend.length
  const bw = Math.min(46, slot * 0.58)
  const gridlines = []
  for (let v = 0; v <= top; v += step) {
    gridlines.push({ y: y(v), label: formatMoney(v) })
  }
  const bars = spend.map((v, i) => {
    const x = L + slot * i + (slot - bw) / 2
    const isCur = i === spend.length - 1
    const isPrev = i === spend.length - 2
    return {
      key: i,
      x,
      y: y(v),
      w: bw,
      h: Math.max(0, y(0) - y(v)),
      isCur,
      isPrev,
      value: formatMoney(v),
      month: MONTH_ABBREVIATIONS[monthsWindow.value[i].month],
    }
  })
  return { gridlines, bars, avgY: y(props.insight.avg), baseY: H - 10 }
})

const chartLabel = computed(() => {
  const first = monthsWindow.value[0]
  return `${props.insight.name} spending, ${monthName(first)} to ${monthName(props.selected)} ${props.selected.year}`
})

function driverClass(d: Driver): string {
  return d.change > 0 ? 'up' : d.change < 0 ? 'down' : 'flat'
}
</script>

<template>
  <aside class="detail" aria-live="polite" data-testid="insight-detail">
    <div class="detail-head">
      <div>
        <h3>{{ insight.name }}</h3>
        <p>{{ headline(insight, selected) }}</p>
      </div>
      <span class="pill" :class="changeClass">{{ insight.ratio === null ? 'new' : formatPct(insight.ratio) }}</span>
    </div>

    <div class="facts">
      <div class="fact">
        <span class="kicker">{{ monthName(selected) }}</span><span class="v num">{{ formatMoney(insight.cur) }}</span>
      </div>
      <div class="fact">
        <span class="kicker">{{ monthName(previous) }}</span><span class="v num">{{ formatMoney(insight.prev) }}</span>
      </div>
      <div class="fact">
        <span class="kicker">vs 6-mo avg</span>
        <span class="v num">{{ formatSigned(Math.round(insight.cur - insight.avg)) }}</span>
      </div>
    </div>

    <div>
      <div class="chart-box">
        <svg :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="chartLabel">
          <g v-for="g in chart.gridlines" :key="g.y">
            <line :x1="L" :x2="W - R" :y1="g.y" :y2="g.y" class="grid" />
            <text :x="L - 8" :y="g.y + 4" text-anchor="end" class="axis num">{{ g.label }}</text>
          </g>
          <g v-for="bar in chart.bars" :key="bar.key">
            <rect
              :x="bar.x"
              :y="bar.y"
              :width="bar.w"
              :height="bar.h"
              rx="3"
              :class="bar.isCur ? 'bar cur' : bar.isPrev ? 'bar prev' : 'bar'"
            />
            <text
              v-if="bar.isCur || bar.isPrev"
              :x="bar.x + bar.w / 2"
              :y="bar.y - 5"
              text-anchor="middle"
              class="bar-value num"
            >
              {{ bar.value }}
            </text>
            <text :x="bar.x + bar.w / 2" :y="chart.baseY" text-anchor="middle" :class="bar.isCur ? 'month cur' : 'month'">
              {{ bar.month }}
            </text>
          </g>
          <line :x1="L" :x2="W - R" :y1="chart.avgY" :y2="chart.avgY" class="avg" />
        </svg>
      </div>
      <div class="legend">
        <span><i class="solid"></i>Selected month</span>
        <span><i></i>6-month average {{ formatMoney(Math.round(insight.avg)) }}</span>
      </div>
    </div>

    <div v-if="drivers.length" class="drivers">
      <h4>What changed</h4>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>{{ MONTH_ABBREVIATIONS[previous.month] }}</th>
              <th>{{ MONTH_ABBREVIATIONS[selected.month] }}</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in drivers" :key="d.name">
              <td>
                {{ d.name }}<span v-if="d.meta" class="meta">{{ d.meta }}</span>
              </td>
              <td class="num">{{ formatMoney(d.prev) }}</td>
              <td class="num">{{ formatMoney(d.cur) }}</td>
              <td>
                <span class="pill" :class="driverClass(d)">{{ Math.round(d.change) === 0 ? '—' : formatSigned(d.change) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- The Transactions page has no "uncategorised" category filter to deep-link to. -->
    <div v-if="insight.category" class="actions">
      <RouterLink :to="transactionsLink" class="link-btn">
        View {{ insight.name.toLowerCase() }} transactions for {{ monthName(selected) }} →
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
.detail {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -12px rgba(0, 0, 0, 0.1);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 16px;
}

@media (max-width: 880px) {
  .detail {
    position: static;
  }
}

.detail-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.detail-head h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-h);
}

.detail-head p {
  margin: 2px 0 0;
  color: var(--text-h);
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

@media (max-width: 420px) {
  .facts {
    grid-template-columns: 1fr 1fr;
  }
}

.fact {
  background: var(--field-bg);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fact .v {
  color: var(--text-h);
  font-weight: 600;
  font-size: 15px;
}

.chart-box {
  overflow-x: auto;
}

.chart-box svg {
  display: block;
  width: 100%;
  height: auto;
  min-width: 320px;
}

.grid {
  stroke: var(--border);
  stroke-width: 1;
}

.axis,
.month {
  font-size: 11px;
  fill: var(--text);
}

.month.cur {
  fill: var(--text-h);
  font-weight: 600;
}

.bar {
  fill: var(--border);
}

.bar.prev {
  fill: var(--text);
  fill-opacity: 0.55;
}

.bar.cur {
  fill: var(--accent);
}

.bar-value {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-h);
}

.avg {
  stroke: var(--text);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  margin-top: 6px;
}

.legend i {
  display: inline-block;
  width: 14px;
  height: 0;
  border-top: 2px dashed var(--text);
  vertical-align: 3px;
  margin-right: 6px;
}

.legend i.solid {
  border-top: 8px solid var(--accent);
  border-radius: 2px;
  vertical-align: 1px;
}

.drivers h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text-h);
}

.table-scroll {
  overflow-x: auto;
}

.drivers table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.drivers th {
  text-align: right;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
}

.drivers th:first-child,
.drivers td:first-child {
  text-align: left;
  padding-left: 0;
}

.drivers td {
  text-align: right;
  padding: 7px 8px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.drivers td:first-child {
  color: var(--text-h);
  white-space: normal;
}

.meta {
  color: var(--text);
  font-size: 12px;
  display: block;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.link-btn {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 7px 12px;
  color: var(--accent);
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
}

.link-btn:hover {
  border-color: var(--accent);
}
</style>
