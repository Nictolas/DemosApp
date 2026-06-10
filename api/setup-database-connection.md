# 🔧 Setup connessione database locale

## Passo 1: Crea il file `.env`

Crea un file `.env` nella cartella `api/` (puoi copiare da `env.example`):

```bash
# Database Supabase PostgreSQL
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_POOL_MIN=0
DATABASE_POOL_MAX=15

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

PORT=3001
NODE_ENV=development
```

## Passo 2: Ottieni la connection string

1. [Supabase Dashboard](https://supabase.com/dashboard) → il tuo progetto
2. **Project Settings → Database**
3. Per l’API: **Connection pooling → Transaction** → copia la URI e aggiungi `&pgbouncer=true` se manca
4. Per dump/migrazione: usa la URI **Direct** (vedi `MIGRAZIONE_NEON_SUPABASE.md`)

## Passo 3: Testa la connessione

```bash
cd api
node -e "require('dotenv').config(); require('./config/database').testConnection().then(console.log)"
```

Oppure avvia il server e apri `http://localhost:3001/api/health`.
