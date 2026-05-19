import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/Physical-vs-Paper-Delta-v1/',
  plugins: [react(), tailwindcss()],
})
