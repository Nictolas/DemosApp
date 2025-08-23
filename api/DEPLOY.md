# 🚀 Deploy su Render

## Configurazione Automatica

1. **Vai su [Render.com](https://render.com)**
2. **Clicca "New +" → "Web Service"**
3. **Connetti il repository GitHub**
4. **Configura il servizio:**
   - **Name:** `demos-api`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`

## Variabili d'Ambiente

Configura queste variabili su Render:

- `DATABASE_URL`: URL del database Neon
- `JWT_SECRET`: Chiave segreta per JWT
- `RESEND_API_KEY`: Chiave API per Resend (email)
- `NODE_ENV`: `production`

## Endpoints Disponibili

- `GET /api/capo-stato` - Classifica candidati
- `POST /api/capo-stato/vota` - Salva voti
- `GET /api/elezioni/prossime` - Prossime elezioni
- `POST /api/comunicazioni` - Crea comunicazioni
- `GET /api/eventi` - Lista eventi
- `GET /api/users` - Gestione utenti

## Test Rapido

Dopo il deploy, testa:

```bash
curl https://demos-api.onrender.com/api/capo-stato
```

## Aggiornamento Frontend

Aggiorna `client/src/lib/api-config.ts`:

```typescript
export const getApiBaseUrl = () => {
  return 'https://demos-api.onrender.com/api';
};
```
