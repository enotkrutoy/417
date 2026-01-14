import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Validates and exposes process.env.API_KEY to the client during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    build: {
      chunkSizeWarningLimit: 1000, // Increase limit to 1MB to avoid warnings for large libs
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor code into separate chunks for better caching
            'react-vendor': ['react', 'react-dom'],
            'utils-vendor': ['bwip-js', '@zxing/library', 'tesseract.js'],
            'genai-vendor': ['@google/genai'],
            'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge']
          }
        }
      }
    }
  }
})