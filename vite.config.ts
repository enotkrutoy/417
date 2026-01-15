
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // Load environment variables from the current working directory
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
            'utils-vendor': ['bwip-js'],
            'genai-vendor': ['@google/genai'],
            'ui-vendor': ['lucide-react']
          }
        }
      }
    }
  }
})
