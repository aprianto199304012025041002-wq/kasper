import { defineConfig } from 'vite'
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Minify agresif
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // hapus console.log di production
        drop_debugger: true,
        passes: 2,
      },
    },
    // Inline small assets
    assetsInlineLimit: 4096,
    // Source map off di production
    sourcemap: false,
    // CSS code splitting off — satu file CSS lebih efisien untuk app kecil
    cssCodeSplit: false,
  }
})
