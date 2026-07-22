import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/ui'),
    },
  },
  // this is needed by mac to work
  base: "./",
  // makes sure it renders /dist
  build: {
    outDir: "dist-react"
  },
  // this is config of hot module reloading servers
  server: {
    port: 5123,
    strictPort: true,
  }
})

