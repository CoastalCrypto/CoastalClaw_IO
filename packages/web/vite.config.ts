import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
const proxy = {
  '/api': 'http://127.0.0.1:4747',
  '/ws':  { target: 'ws://127.0.0.1:4747', ws: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server:  { proxy },
  preview: { proxy },   // same proxy for `vite preview` (install/APT mode)
})
