import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages（https://<user>.github.io/kokkaku-prototype/）で動くよう base を合わせる
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
})
