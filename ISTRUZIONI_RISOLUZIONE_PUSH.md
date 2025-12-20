# 🔧 Risoluzione Problema Push Notifiche

## ❌ Errore Attuale

```
FirebaseError: Messaging: A problem occurred while subscribing the user to FCM: 
Request is missing required authentication credential. 
Expected OAuth 2 access token, login cookie or other valid authentication credential.
```

## 🔍 Causa del Problema

L'errore indica che Firebase non riesce ad autenticarsi perché:

1. **Le variabili `VITE_FIREBASE_*` non sono disponibili durante il BUILD su Render.com**
   - Vite usa queste variabili SOLO durante il build
   - Se non sono presenti durante il build, `import.meta.env.VITE_FIREBASE_VAPID_KEY` sarà `undefined`
   - Senza la VAPID key, Firebase non può autenticarsi

2. **Il frontend non è stato rideployato dopo aver aggiunto le variabili**
   - Le variabili d'ambiente devono essere presenti PRIMA del build
   - Dopo averle aggiunte su Render.com, devi fare un nuovo deploy

## ✅ Soluzione

### Passo 1: Verifica Variabili su Render.com

Vai su **Render.com → `demos-frontend` → Environment** e verifica che ci siano:

```
VITE_FIREBASE_PROJECT_ID=demos-finale
VITE_FIREBASE_MESSAGING_SENDER_ID=848085963511
VITE_FIREBASE_VAPID_KEY=(la tua VAPID key)
```

**IMPORTANTE**: Se manca `VITE_FIREBASE_VAPID_KEY`, devi generarla:

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto `demos-finale`
3. Vai su **Cloud Messaging** → **Web Push certificates**
4. Se non esiste, clicca **"Generate key pair"**
5. Copia la chiave pubblica → incollala in `VITE_FIREBASE_VAPID_KEY` su Render.com

### Passo 2: Rideploy Frontend

**DOPO** aver aggiunto/modificato le variabili su Render.com:

1. Vai su **Render.com → `demos-frontend` → Manual Deploy**
2. Clicca **"Deploy latest commit"**
3. Oppure fai un commit e push (se auto-deploy è attivo)

**IMPORTANTE**: Il deploy è necessario perché Vite usa le variabili `VITE_*` durante il build, non a runtime!

### Passo 3: Verifica nel Browser

Dopo il deploy, apri la webapp e controlla la console:

✅ **Dovresti vedere:**
- `✅ Firebase Messaging inizializzato per web push`
- `🔑 VAPID Key check: Presente (...)` 
- `✅ Token FCM ottenuto: ...` (con un token lungo, NON `web_...`)

❌ **Se vedi ancora:**
- `VAPID Key check: MANCANTE` → Le variabili non sono state caricate durante il build
- `Errore nel recupero token FCM` → Verifica che la VAPID key sia corretta

### Passo 4: Verifica Token nel Database

Dopo aver ottenuto il token FCM, verifica nel database:

```sql
SELECT id, email, fcm_tokens 
FROM users 
WHERE fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 0;
```

✅ **Token FCM reale**: Lungo (150+ caratteri), inizia con caratteri alfanumerici
❌ **Device ID fittizio**: Inizia con `web_`, corto (circa 30 caratteri)

## 🧪 Test

Dopo aver risolto, testa l'invio di una notifica:

1. Vai su `https://www.demos.community/comunica`
2. Compila il form "Notifiche Demos"
3. Clicca "Invia Notifica a Tutti"
4. Dovresti ricevere la notifica push sul browser

## 📝 Note

- Le variabili `VITE_*` sono disponibili SOLO durante il build
- Dopo il build, non puoi modificarle senza fare un nuovo deploy
- Il Service Worker (`firebase-messaging-sw.js`) ha le credenziali hardcoded, quindi funziona anche senza variabili d'ambiente
- Ma il client (`useFCM.ts`) ha bisogno delle variabili durante il build per generare il token FCM

