<script setup lang="ts">
import { computed } from 'vue'

// Small area sparkline with an end dot (UBE-118, mockup's sparkline()).
const props = defineProps<{ values: number[]; colour: string }>()

const W = 84
const H = 26
const P = 3

const points = computed(() => {
  const max = Math.max(...props.values, 1)
  const n = Math.max(props.values.length - 1, 1)
  return props.values.map((v, i) => [P + (i * (W - 2 * P)) / n, H - P - (v / max) * (H - 2 * P)] as const)
})
const line = computed(() => points.value.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '))
const area = computed(() => `${P},${H - P} ${line.value} ${W - P},${H - P}`)
const last = computed(() => points.value[points.value.length - 1] ?? [0, 0])
</script>

<template>
  <svg class="spark" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" aria-hidden="true">
    <polygon :points="area" :fill="colour" fill-opacity="0.12" />
    <polyline :points="line" fill="none" :stroke="colour" stroke-width="1.6" stroke-linejoin="round" />
    <circle :cx="last[0].toFixed(1)" :cy="last[1].toFixed(1)" r="2.6" :fill="colour" />
  </svg>
</template>

<style scoped>
.spark {
  display: block;
}
</style>
