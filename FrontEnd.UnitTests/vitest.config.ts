import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Test sources under ../FrontEnd/src fall outside this project's directory tree, so Vite's
  // filesystem tsconfig auto-discovery can walk up into FrontEnd's solution-style tsconfig.json
  // (references-only, no compilerOptions) and fail to resolve it. Providing the compiler options
  // directly sidesteps that lookup.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'esnext',
        useDefineForClassFields: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
