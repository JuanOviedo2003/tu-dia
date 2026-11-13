import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const chunkFor = (id) => {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase'
  if (id.includes('/@dnd-kit/')) return 'dnd'
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: { manualChunks: chunkFor },
    },
  },
})
