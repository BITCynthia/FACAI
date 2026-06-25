import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 开发期把 /api 转发到 FastAPI 后端，彻底避免 CORS。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
