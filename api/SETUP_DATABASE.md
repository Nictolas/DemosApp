# 🚨 Configurazione database richiesta

## Problema

L’API non si avvia se manca `api/.env` con `DATABASE_URL`.

## Soluzione

Crea `api/.env` (vedi `env.example`):

```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
JWT_SECRET=your-super-secret-jwt-key-change-in-production
DATABASE_POOL_MAX=15
```

## Dove trovare la URI

**Supabase** → Project Settings → Database → Connection string (pooler per l’app, direct per migrazioni).

Guida completa migrazione da Neon: **`MIGRAZIONE_NEON_SUPABASE.md`**.

## Dopo la configurazione

1. `cd api && npm start` (o `node server.js`)
2. `http://localhost:3001/api/health`
3. Prova login / una route che usa il DB
