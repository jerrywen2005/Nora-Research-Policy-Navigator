import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Dev-only proxy: the browser calls /api/* on the Vite server, which forwards
// to FastAPI. The frontend and API then share one origin, so no CORS is needed.
// In production nginx does the same forwarding (see nginx.conf).
// API_PROXY_TARGET is http://backend:8000 under docker compose.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  // `npm test`: Vitest runs *.test.ts(x) files in a simulated browser (jsdom).
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
})
