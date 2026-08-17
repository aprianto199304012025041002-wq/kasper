import { defineConfig } from 'vite'
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    assetsInlineLimit: 4096,
    sourcemap: false,
    cssCodeSplit: false,
  }
})
