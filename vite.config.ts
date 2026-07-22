import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/bio_synaptic/',
  resolve: {
    alias: {
      '@ppradyoth/bio-synaptic-engine': path.resolve(__dirname, './packages/engine/src/index.ts'),
    },
  },
})
