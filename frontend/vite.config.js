import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development' || process.env.NODE_ENV === 'development';
  const enableDevLogin = Boolean(process.env.VITE_DEV_LOGIN_ENABLED === 'true' && isDev);

  return {
    plugins: [react()],
    define: {
      __DEV_LOGIN_ENABLED__: JSON.stringify(enableDevLogin),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
})

