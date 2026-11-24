import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Data/ora della build: si vede in fondo al Profilo, utile per capire se hai l'ultima versione.
const build = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default defineConfig({
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // librerie che cambiano di rado in file a parte: restano nella cache del telefono tra un aggiornamento e l'altro
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
