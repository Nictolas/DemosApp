#!/bin/bash

# Script di build personalizzato per Vercel
echo "🚀 Iniziando build personalizzato..."

# Installa dipendenze nella cartella client
cd client
echo "📦 Installando dipendenze..."
npm install

# Verifica che vite sia installato
if ! command -v npx vite &> /dev/null; then
    echo "❌ Vite non trovato, installando manualmente..."
    npm install vite@^5.3.1 @vitejs/plugin-react@^4.3.1
fi

# Esegui il build
echo "🔨 Eseguendo build..."
npm run build

echo "✅ Build completato!"
