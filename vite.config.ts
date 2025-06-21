import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],

  // Specifica che la root del progetto Vite è la cartella 'client'
  root: "client",

  resolve: {
    // L'alias '@' ora punta correttamente a 'client/src'
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },

  build: {
    // Dalla root ('client'), vai su di un livello (..) e poi in 'dist/public'
    outDir: "../dist/public",
    emptyOutDir: true,
  },
});