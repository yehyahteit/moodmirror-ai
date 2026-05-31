import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/analyze': 'http://localhost:8000',
      '/history': 'http://localhost:8000',
    },
  },
  // Expose backend URL to the app at build time
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
})
