import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // Source under test is imported from ../FrontEnd/src, which has its own
    // node_modules with these same packages - without deduping, that copy and
    // this project's copy end up as two separate module instances (e.g. two
    // unrelated Pinia "active instance" singletons).
    dedupe: ['vue', 'pinia', 'vue-router'],
  },
  test: {
    environment: 'jsdom',
  },
})
