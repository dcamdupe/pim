<script setup lang="ts">
withDefaults(
  defineProps<{
    kicker: string
    label: string
    value: string
    showDelta?: boolean
    deltaPct?: number | null
  }>(),
  {
    showDelta: false,
    deltaPct: null,
  },
)

function formatDelta(pct: number | null): string {
  if (pct === null) {
    return '— flat'
  }
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`
}

function deltaClass(pct: number | null): string {
  if (pct === null) {
    return 'flat'
  }
  return pct >= 0 ? 'up' : 'down'
}
</script>

<template>
  <div class="kpi">
    <div class="kpi-top">
      <span class="kicker">{{ kicker }}</span>
      <!-- Always renders a same-sized .delta-pill, visible or not, so tiles with and without a
           real delta stay pixel-identical above the label/value - a reserved-but-empty div can't
           guarantee that since its height isn't tied to the pill's actual font/padding. -->
      <span class="delta-pill" :class="showDelta ? deltaClass(deltaPct) : 'placeholder'">
        {{ showDelta ? formatDelta(deltaPct) : '—' }}
      </span>
    </div>
    <div class="label">{{ label }}</div>
    <div class="value">{{ value }}</div>
  </div>
</template>

<style scoped>
.kpi {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 8px 24px -12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kicker {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--text);
}

.delta-pill {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
  white-space: nowrap;
}

.delta-pill.up {
  background: rgba(12, 163, 12, 0.12);
  color: #0ca30c;
}

.delta-pill.down {
  background: rgba(211, 51, 51, 0.12);
  color: #d33;
}

.delta-pill.flat {
  background: var(--field-bg);
  color: var(--text);
}

.delta-pill.placeholder {
  visibility: hidden;
}

.kpi .label {
  font-size: 12px;
  color: var(--text);
  font-weight: 600;
}

.kpi .value {
  font-size: 26px;
  font-weight: 800;
  color: var(--text-h);
}
</style>
