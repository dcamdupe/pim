import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Test sources under ../FrontEnd/src fall outside this project's directory tree, so Vite's
  // filesystem tsconfig auto-discovery can walk up into FrontEnd's solution-style tsconfig.json
  // (references-only, no compilerOptions) and fail to resolve it. Disabling Vite 8's default Oxc
  // transformer (which doesn't support overriding tsconfig discovery) in favour of esbuild, and
  // providing the compiler options directly, sidesteps that lookup.
  oxc: false,
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
