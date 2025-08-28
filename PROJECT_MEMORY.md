# 🧠 MEMORIA PERSISTENTE DEL PROGETTO - NON DIMENTICARE MAI!

## 🏗️ **ARCHITETTURA ATTUALE:**
- **Render**: Backend/API + Frontend (MIGRAZIONE IN CORSO)
- **Vercel**: ABBANDONATO - troppi problemi
- **Database**: Neon (PostgreSQL)
- **Auth**: Auth.js integrato con Neon

## 🎯 **STRUTTURA PROGETTO:**
- **Root**: Monorepo con `client/` (Vite) e `api/` (Express)
- **Frontend**: React + Vite in `client/`
- **Backend**: Express API in `api/`
- **Build**: `npm run build` builda solo il client

## 🚨 **PROBLEMI RISOLTI (NON RIPETERE!):**
- ✅ **Database**: Migrato da Keliweb a Neon
- ✅ **Auth**: Auth.js integrato con Neon
- ✅ **Email**: Resend per invio email (NON Gmail SMTP)
- ✅ **Backend**: Funziona su Render
- ✅ **Build locale**: `npm run build` funziona al 100%

## 🚫 **PROBLEMI RISOLTI:**
- ✅ **Vercel**: Ricreato con webhook attivo
- ✅ **DNS**: Aggiornati per puntare a Vercel
- ✅ **Configurazione**: Vercel configurato per frontend
- ✅ **Build Settings**: Root Directory = client, Build Command = npm run build
- ✅ **Production Overrides**: Disabilitati (non più sovrascrivono)

## 🔧 **SOLUZIONI PROVATE (NON RIPETERE!):**
- ❌ **vercel.json personalizzato**: Ignorato da Vercel
- ❌ **Script build personalizzati**: Non funzionano
- ❌ **Reset configurazioni**: Non ha risolto
- ❌ **Override disabilitati**: Non ha funzionato

## 📋 **REGOLE IMPORTANTI:**
1. **NON creare tabelle** senza permesso utente
2. **NON suggerire soluzioni già provate** (girare in tondo)
3. **Usare sempre le tabelle designate**: users per Rappresentanti, tabelle specifiche per Profilo/Opinioni
4. **NON implementare features** non richieste esplicitamente
5. **Navbar deve essere fixed** su tutte le pagine
6. **Accesso diretto a Firebase** invece di API custom

## 🎯 **OBIETTIVO ATTUALE:**
- **MIGRAZIONE COMPLETA SU RENDER** (backend + frontend)
- **Mantenere dominio** www.demos.community
- **Configurare deploy automatico** GitHub → Render
- **Vercel completamente rimosso**

## 🔍 **ULTIMA CONFIGURAZIONE VERCEL:**
```json
{
  "version": 2,
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "ignoreCommand": "git diff --quiet HEAD^ HEAD ./client/",
  "functions": {}
}
```

## 📊 **STATO ATTUALE:**
- **Backend**: ✅ Funziona su Render
- **Frontend Build**: ✅ Funziona localmente
- **Deploy Vercel**: ❌ Non funziona automatico
- **GitHub**: ✅ Push funzionano
- **Database**: ✅ Neon funziona
- **Auth**: ✅ Auth.js funziona

## 🚀 **PROSSIMI PASSI SUGGERITI:**
1. **Testare configurazione Vercel attuale** con push
2. **Se non funziona**: Considerare alternative per frontend
3. **Mantenere Render** per backend (già funzionante)

## 💡 **NOTE IMPORTANTI:**
- L'utente preferisce che l'assistente capisca il problema e proponga soluzioni prima di chiedere azioni
- L'utente preferisce che l'assistente dica subito se non può fare qualcosa invece di perdere tempo
- Il progetto è funzionante in locale, il problema è solo il deploy automatico su Vercel

---
**Ultimo aggiornamento**: 27/08/2025 - Problema Vercel non builda frontend automaticamente
**Prossimo controllo**: Test configurazione Vercel attuale con push
