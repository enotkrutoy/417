import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  // Prioritize VITE_API_KEY, fallback to API_KEY, default to empty string
  const apiKey = env.VITE_API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // By using JSON.stringify, we ensure the code receives a string literal (e.g., "AIza...")
      // or an empty string literal "" if undefined. This prevents 'process is not defined' errors.
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
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