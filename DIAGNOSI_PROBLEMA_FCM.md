# 🔍 Diagnosi Problema Token FCM

## Situazione Attuale

✅ **Utenti con `demos: true`**: 3 utenti trovati
- Nicolas Micheletti (MCHNLS90L11G702W@cie.local)
- Mattia Picariello (mattia.picariello@hotmail.it)
- Nicolas Micheletti (nicolasmicheletti90@gmail.com)

❌ **Token FCM salvati**: 0 token trovati

## Problema Identificato

Gli utenti hanno attivato le notifiche Demos nelle preferenze (`notifiche_preferenze->>'demos' = 'true'`), ma **non hanno token FCM salvati** nel database.

### Possibili Cause

1. **Firebase non configurato nel frontend**
   - Le variabili d'ambiente `VITE_FIREBASE_*` non sono configurate
   - `useFCM` genera solo un device ID fittizio invece di un token FCM reale
   - Il device ID non funziona per le notifiche push reali

2. **Utenti non hanno ancora concesso i permessi**
   - Gli utenti devono aprire la webapp e concedere i permessi per le notifiche
   - Solo dopo aver concesso i permessi, Firebase genera un token FCM reale

3. **Service Worker non registrato**
   - Il file `firebase-messaging-sw.js` non è configurato correttamente
   - Firebase richiede un Service Worker per le notifiche push web

## Soluzione

### Passo 1: Configurare Firebase nel Frontend

Le variabili d'ambiente Firebase devono essere configurate su **Render.com per il servizio `demos-frontend`**:

1. Vai su Render.com → `demos-frontend` → Environment
2. Aggiungi queste variabili:
   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_VAPID_KEY=your_vapid_key
   ```

3. **Rideploy** il frontend dopo aver aggiunto le variabili

### Passo 2: Configurare Service Worker

Il file `client/public/firebase-messaging-sw.js` deve essere aggiornato con le credenziali Firebase o deve riceverle dinamicamente dal client.

### Passo 3: Utenti devono concedere permessi

Una volta configurato Firebase:
1. Gli utenti devono aprire la webapp
2. Il browser chiederà i permessi per le notifiche
3. Dopo aver concesso i permessi, `useSyncFcmToken` salverà automaticamente il token FCM
4. Il token verrà salvato tramite `POST /api/fcm-tokens`

## Verifica

Dopo aver configurato Firebase, verifica:

```bash
node verifica-utenti-demos-fcm.cjs
```

Dovresti vedere:
- ✅ Utenti con `demos: true` E token FCM salvati
- ✅ Token FCM con formato corretto (lungo, non device ID)

## Note

- Il device ID generato quando Firebase non è configurato **NON funziona** per le notifiche push reali
- Serve un token FCM reale generato da Firebase Cloud Messaging
- Le notifiche push web funzionano solo su HTTPS (o localhost per sviluppo)

