import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    headers: {
      // Required for SharedArrayBuffer (ONNX threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    fs: {
      // Allow serving files from node_modules for ONNX Runtime
      allow: ['..']
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web', 'onnxruntime-web/wasm']
  },
  build: {
    // Don't process WASM files
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // Keep WASM files separate
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return '[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
