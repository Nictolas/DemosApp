# 📱 Setup Notifiche Push Web

## ✅ Modifiche Completate

### 1. Sistema FCM per Web
- ✅ Rimosso Capacitor Push Notifications (non necessario per webapp)
- ✅ Implementato Firebase Cloud Messaging SDK per web
- ✅ Hook `useFCM` aggiornato per usare Firebase Messaging
- ✅ Service Worker per gestire notifiche in background

### 2. Endpoint per salvare token FCM
- ✅ `POST /api/fcm-tokens` - Salva/aggiorna token FCM per l'utente autenticato
- ✅ `DELETE /api/fcm-tokens/:token` - Rimuove un token FCM specifico

### 3. Salvataggio automatico token FCM
- ✅ `useSyncFcmToken` sincronizza automaticamente il token quando l'utente è loggato

### 4. Sistema di invio notifiche push
- ✅ Funzione `sendPushNotification()` già implementata nel backend
- ✅ Supporto web push tramite Firebase Admin SDK

## 🔧 Configurazione Necessaria

### 1. Installare Firebase SDK

```bash
cd client
npm install firebase
```

### 2. Configurare variabili d'ambiente

Aggiungi al file `.env` nella cartella `client/`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

### 3. Ottenere le credenziali Firebase

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto (o creane uno nuovo)
3. Vai su "Impostazioni progetto" (⚙️)
4. Nella sezione "Le tue app", aggiungi un'app web se non esiste
5. Copia le credenziali nel file `.env`

### 4. Ottenere VAPID Key

1. In Firebase Console, vai su "Cloud Messaging"
2. Nella sezione "Web configuration", trova "Web Push certificates"
3. Se non esiste, clicca "Generate key pair"
4. Copia la chiave pubblica in `VITE_FIREBASE_VAPID_KEY`

### 5. Configurare Service Worker

Il file `client/public/firebase-messaging-sw.js` deve essere aggiornato con le tue credenziali Firebase, oppure puoi passarle dinamicamente dal client.

**Opzione 1: Hardcode nel Service Worker** (semplice ma meno sicuro)
Modifica `client/public/firebase-messaging-sw.js` con le tue credenziali.

**Opzione 2: Passaggio dinamico** (consigliato)
Il Service Worker può ricevere le credenziali dal client tramite `postMessage`.

### 6. Firebase Admin SDK (Backend)

**File necessario:** `serviceAccountKey.json` nella root del progetto o in `api/`

**Come ottenerlo:**
1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto
3. Vai su "Impostazioni progetto" → "Account di servizio"
4. Clicca "Genera nuova chiave privata"
5. Salva il file come `serviceAccountKey.json`

**Percorsi cercati dal sistema:**
- `api/serviceAccountKey.json`
- `serviceAccountKey.json` (root)
- Variabile d'ambiente `FIREBASE_SERVICE_ACCOUNT_PATH`

## 📱 Come Funziona

### Flusso Completo

1. **Utente apre la webapp**
   - L'app richiede il permesso per le notifiche push
   - Firebase Messaging SDK si inizializza
   - Service Worker viene registrato

2. **Token viene generato**
   - Firebase genera un token FCM univoco per il browser
   - `useSyncFcmToken` salva automaticamente il token sul server tramite `POST /api/fcm-tokens`

3. **Utente attiva "Notifiche Demos"**
   - Nelle impostazioni, attiva la preferenza `demos: true`
   - Query: `UPDATE users SET notifiche_preferenze = jsonb_set(COALESCE(notifiche_preferenze, '{}'::jsonb), '{demos}', 'true'::jsonb) WHERE id = 'USER_ID'`

4. **Invio notifica**
   - Chiama `POST /api/comunicazioni/send-demos-notification`
   - Il sistema:
     - Crea comunicazione nella tabella `comunicazioni`
     - Trova utenti con `demos: true` e `fcm_tokens` non vuoto
     - Invia push notification a ogni token FCM tramite Firebase Admin SDK
     - Rimuove token non validi automaticamente

## 🧪 Test

### Test Database
```bash
node verifica-fcm-tokens.cjs
```

### Test Sistema Completo
```bash
node test-notifiche-demos.cjs
```

### Test Invio Notifica
```bash
curl -X POST https://www.demos.community/api/comunicazioni/send-demos-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REDACTED_TOKEN>" \
  -d '{
    "titolo": "Test Notifica",
    "messaggio": "Questo è un test"
  }'
```

## ⚠️ Problemi Comuni

### 1. Token FCM non salvati
**Sintomo:** Nessun utente ha token FCM nel database

**Soluzione:**
- Verifica che le credenziali Firebase siano configurate nel `.env`
- Verifica che il Service Worker sia registrato correttamente
- Controlla la console del browser per errori
- Verifica che l'utente abbia concesso i permessi per le notifiche

### 2. Firebase Admin non configurato
**Sintomo:** `Firebase Admin non disponibile` nei log

**Soluzione:**
- Installa `firebase-admin`: `npm install firebase-admin` (in `api/`)
- Aggiungi `serviceAccountKey.json` nel percorso corretto
- Verifica le variabili d'ambiente

### 3. Notifiche non arrivano
**Sintomo:** Notifiche inviate ma non ricevute nel browser

**Verifica:**
- Token FCM validi nel database
- Preferenza `demos: true` attiva
- Firebase Admin configurato correttamente
- Service Worker registrato correttamente
- Permessi notifiche concessi nel browser
- Browser supporta Web Push (Chrome, Firefox, Edge - Safari non supporta)

### 4. Service Worker non si registra
**Sintomo:** Errore nella registrazione del Service Worker

**Soluzione:**
- Verifica che `firebase-messaging-sw.js` sia nella cartella `public/`
- Verifica che il file sia accessibile (deve essere servito dal server)
- Controlla che le credenziali Firebase nel Service Worker siano corrette

## 📊 Monitoraggio

### Log da controllare:
- `✅ Service Worker registrato per FCM`
- `✅ Token FCM ottenuto: ...`
- `📤 Invio push notifications a X utenti...`
- `✅ Push notifications Demos inviate: X successi, Y fallimenti`
- `⚠️ Token FCM non valido o non registrato`

### Query utili:

**Utenti pronti per push:**
```sql
SELECT id, email, 
       notifiche_preferenze->>'demos' as demos,
       array_length(fcm_tokens, 1) as token_count
FROM users 
WHERE notifiche_preferenze->>'demos' = 'true'
  AND fcm_tokens IS NOT NULL 
  AND array_length(fcm_tokens, 1) > 0;
```

**Ultime comunicazioni Demos:**
```sql
SELECT id, titolo, testo, data_creazione, tipo
FROM comunicazioni 
WHERE tipo = 'demos_notification'
ORDER BY data_creazione DESC
LIMIT 10;
```

## 🎯 Prossimi Passi

1. ✅ Rimosso Capacitor Push Notifications
2. ✅ Implementato Firebase Messaging SDK per web
3. ⏳ Configurare credenziali Firebase nel `.env`
4. ⏳ Configurare Service Worker con credenziali Firebase
5. ⏳ Configurare Firebase Admin con `serviceAccountKey.json`
6. ⏳ Testare invio notifiche push web

## 📝 Note

- **Safari non supporta Web Push** su desktop (solo iOS Safari con alcune limitazioni)
- Le notifiche push web funzionano solo su HTTPS (o localhost per sviluppo)
- Il Service Worker deve essere servito dalla stessa origine dell'app
- I token FCM possono scadere e devono essere rigenerati periodicamente

