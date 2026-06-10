# Migrazione database: Neon → Supabase

L’API Demos usa **PostgreSQL** tramite `pg` e la variabile `DATABASE_URL`. Non c’è SDK Neon nel codice: il passaggio a Supabase è soprattutto **export/import dati** + **nuova connection string**.

## Panoramica

| Cosa | Azione |
|------|--------|
| Schema e dati | `pg_dump` da Neon → restore su Supabase |
| App (Render, locale) | Sostituire `DATABASE_URL` |
| Pool connessioni | Usare **Supavisor** (pooler) e limitare `DATABASE_POOL_MAX` |
| Metriche admin Neon | Opzionale: rimuovere `NEON_API_KEY`, `NEON_PROJECT_ID`, ecc. |

## 1. Crea il progetto Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Salva la **password** del ruolo `postgres` (serve per dump/restore e per la URI)
3. **Project Settings → Database**:
   - **Connection string → URI** (direct, porta 5432) — utile per migrazione e script una tantum
   - **Connection pooling → Transaction mode** (porta **6543**) — consigliata per l’API Node su Render con pool `pg`

Esempio URI pooler (transaction mode, adatta al pool dell’app):

```text
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
```

Per il pooler in transaction mode con `node-pg`, aggiungi anche:

```text
&pgbouncer=true
```

> **Nota:** con `pgbouncer=true` evita prepared statement persistenti su connessioni diverse; il pool in `config/database.js` è compatibile.

## 2. Esporta da Neon

Da terminale (sostituisci con la tua `DATABASE_URL` Neon, preferibilmente **senza** pooler per il dump):

```bash
# Windows PowerShell — imposta la URI Neon (direct o pooler va bene per dump)
$env:NEON_DATABASE_URL = "postgresql://..."

pg_dump "$env:NEON_DATABASE_URL" --no-owner --no-acl -Fc -f demos-neon.dump
```

Formato plain SQL (alternativa):

```bash
pg_dump "$env:NEON_DATABASE_URL" --no-owner --no-acl -f demos-neon.sql
```

Se non hai `pg_dump` installato: installa [PostgreSQL client tools](https://www.postgresql.org/download/windows/) oppure usa il **SQL Editor** Neon solo per piccoli dataset (non ideale per DB grandi).

## 3. Importa su Supabase

Usa la URI **direct** (host `db.[PROJECT_REF].supabase.co`, porta 5432) per restore — più affidabile per migrazioni:

```bash
$env:SUPABASE_DIRECT_URL = "postgresql://postgres.[PROJECT_REF]:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?sslmode=require"

# Dump custom format
pg_restore -d $env:SUPABASE_DIRECT_URL --no-owner --no-acl --clean --if-exists demos-neon.dump

# Oppure SQL plain
psql $env:SUPABASE_DIRECT_URL -f demos-neon.sql
```

Eventuali errori su `CREATE EXTENSION` o ruoli possono essere ignorati se lo schema applicativo è già presente; controlla che tabelle critiche (`users`, `voti_*`, ecc.) esistano da **Table Editor** o:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
```

## 4. Configura l’API

### File locale `api/.env`

```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_POOL_MIN=0
DATABASE_POOL_MAX=15
```

Sul piano Free di Supabase tieni `DATABASE_POOL_MAX` basso (10–20) per non superare il limite connessioni del progetto.

### Render (produzione)

1. Dashboard Render → servizio **demos-api** → **Environment**
2. Aggiorna `DATABASE_URL` con la URI pooler Supabase
3. Imposta `DATABASE_POOL_MIN` / `DATABASE_POOL_MAX` se non già presenti
4. **Manual Deploy** o riavvio del servizio

Rimuovi (opzionale) variabili solo Neon:

- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `NEON_ORG_ID`
- `NEON_*_LIMIT_*`

La dashboard admin continuerà a mostrare metriche DB via query PostgreSQL; la sezione consumo account Neon resterà vuota senza API key.

## 5. Verifica

```bash
cd api
node -e "require('dotenv').config(); require('./config/database').testConnection().then(console.log).catch(console.error)"
```

Oppure avvia l’API e apri:

- `GET http://localhost:3001/api/health`
- `GET /api/admin/monitoring/health` (con token admin)

## 6. Script SQL e job

Gli script in `api/database/*.sql` vanno eseguiti nel **SQL Editor** di Supabase come prima su Neon.

Script Node/Python che usano `DATABASE_URL` (`sync_eci.py`, job, ecc.) funzionano senza modifiche dopo l’aggiornamento env.

## Checklist rapida

- [ ] Progetto Supabase creato
- [ ] Dump Neon completato
- [ ] Restore su Supabase verificato (conteggio tabelle / utenti test)
- [ ] `DATABASE_URL` aggiornata su Render e `.env` locale
- [ ] Pool limitato (`DATABASE_POOL_MAX`)
- [ ] Health check OK
- [ ] Login / una route che legge DB testata in staging o produzione
- [ ] Variabili `NEON_*` rimosse dall’hosting (opzionale)

## Rollback

Tieni Neon attivo finché non hai validato Supabase in produzione. In caso di problemi, ripristina la vecchia `DATABASE_URL` Neon su Render e riavvia.
