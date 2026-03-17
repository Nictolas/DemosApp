# 🔧 Setup Connessione Database Locale

## Passo 1: Crea il file .env

Crea un file `.env` nella cartella `api/` con questo contenuto:

```bash
# Database Neon PostgreSQL
DATABASE_URL=postgresql://username:password@host.db.neon.tech/neondb?sslmode=require

# JWT Secret
JWT_SECRET=[REDACTED_JWT_SECRET]

# Porta server
PORT=3001

# Ambiente
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## Passo 2: Ottieni la stringa di connessione

La stringa `DATABASE_URL` deve essere sostituita con quella reale del database di produzione.

### Opzione A: Dal dashboard Neon
1. Vai su https://console.neon.tech/
2. Seleziona il tuo progetto
3. Vai su "Connection Details"
4. Copia la "Connection String"

### Opzione B: Dal server di produzione
Posso creare un endpoint temporaneo per mostrare la stringa di connessione (senza password).

## Passo 3: Testa la connessione

Una volta configurato, esegui:
```bash
node fix-si-no-values.js
```

Questo eseguirà la correzione dei valori "Sì"/"No" direttamente sul database di produzione.
