import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 개발 중에는 API만 별도 서버(npm run server)로 넘긴다.
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
