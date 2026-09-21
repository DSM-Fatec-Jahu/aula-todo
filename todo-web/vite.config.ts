import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Em desenvolvimento, /api vai para a API local. Em producao quem faz isso e o Firebase Hosting.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
