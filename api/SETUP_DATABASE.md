# 🚨 CONFIGURAZIONE DATABASE RICHIESTA

## ❌ PROBLEMA RILEVATO
L'API server non può avviarsi perché **manca il file `.env`** con la configurazione del database Neon.

## ✅ SOLUZIONE RICHIESTA

**Crea il file `api/.env` con la seguente configurazione:**

```env
# Database Neon PostgreSQL (OBBLIGATORIO)
DATABASE_URL=postgresql://username:password@host.db.neon.tech/neondb?sslmode=require

# JWT Secret per autenticazione
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## 📋 DOVE TROVARE LA DATABASE_URL

1. **Accedi al tuo account Neon** (o Vercel Postgres)
2. **Trova il tuo database** del progetto DEMOS
3. **Copia la connection string** che dovrebbe assomigliare a:
   ```
   postgresql://[user]:[password]@[host]/[database]?sslmode=require
   ```

## 🚀 DOPO AVER CREATO IL FILE .env

1. Riavvia l'API server: `cd api && node index.js`
2. Verifica la connessione: `http://localhost:3001/api/health`
3. Testa l'autenticazione

---

**NOTA**: Senza la DATABASE_URL corretta, l'applicazione non può funzionare perché non può connettersi al database Neon dove sono memorizzati utenti e dati.
