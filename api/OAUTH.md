# Login con Google e Apple (OAuth)

## Variabili d'ambiente

- **GOOGLE_CLIENT_ID** – Client ID dell’app da [Google Cloud Console](https://console.cloud.google.com/) (credenziali OAuth 2.0 per “Web application”).
- **APPLE_CLIENT_ID** – Service ID (o App ID) da [Apple Developer](https://developer.apple.com/) per “Sign in with Apple”.

- **EMAIL_ENCRYPTION_KEY** – (opzionale) Chiave per cifrare le email OAuth in DB (AES-256-GCM). Genera con: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## Frontend (client)

- **VITE_GOOGLE_CLIENT_ID** – Stesso Client ID usato per il bottone “Accedi con Google” (Google Identity Services).
- **VITE_APPLE_CLIENT_ID** – Stesso Service ID usato per “Sign in with Apple” sul web.

Se queste variabili non sono impostate, i pulsanti Google/Apple nella pagina di login non vengono mostrati.

## Database

Tutto in tabella `users`: aggiungere le colonne OAuth con:

```bash
psql $DATABASE_URL -f api/database/add-oauth-columns-users.sql
```

Oppure nel SQL Editor di Neon eseguire il contenuto di `api/database/add-oauth-columns-users.sql` (aggiunge `google_sub` e `apple_user_id` a `users` con indici UNIQUE).
