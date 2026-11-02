import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sourceCatalog } from './server/catalog.ts'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), {
    name: 'server-level-catalog',
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'level-catalog.json', source: JSON.stringify(await sourceCatalog()) })
    },
  }],
  // 개발 중에는 API만 별도 서버(npm run server)로 넘긴다.
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
