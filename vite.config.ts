
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Expose to network for Pi cluster access
    port: 3000,
    watch: {
      usePolling: true // Needed for some Docker/VM environments on Pi
    }
  },
  define: {
    'process.env': process.env
  }
});
