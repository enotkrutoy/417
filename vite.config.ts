
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Use process.cwd() to get the current working directory for loading environment variables
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'utils-vendor': ['bwip-js', '@zxing/library'],
            'genai-vendor': ['@google/genai'],
            'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge']
          }
        }
      }
    }
  }
})
