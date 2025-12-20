# 📱 Setup Notifiche Push Mobile

## ✅ Modifiche Completate

### 1. Colonna `fcm_tokens` creata
- ✅ Colonna `fcm_tokens TEXT[]` aggiunta alla tabella `users`
- ✅ Creata automaticamente se non esiste

### 2. Endpoint per salvare token FCM
- ✅ `POST /api/fcm-tokens` - Salva/aggiorna token FCM per l'utente autenticato
- ✅ `DELETE /api/fcm-tokens/:token` - Rimuove un token FCM specifico

### 3. Salvataggio automatico token FCM
- ✅ Durante la registrazione (`POST /api/auth/register`)
- ✅ Durante il login (`POST /api/auth/login`)
- ✅ Token salvati automaticamente se presenti nel body della richiesta

### 4. Sistema di invio notifiche push
- ✅ Funzione `sendPushNotification()` già implementata
- ✅ Supporto Android, iOS e Web
- ✅ Gestione token non validi (rimozione automatica)

## 🔧 Configurazione Necessaria

### 1. Firebase Admin SDK

**Verifica installazione:**
```bash
cd api
npm list firebase-admin
```

**Se non installato:**
```bash
npm install firebase-admin
```

### 2. Service Account Key

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

### 3. Configurazione App Mobile

**Per Android:**
- File `google-services.json` nella cartella `client/android/app/`
- Configurazione Firebase nel progetto Android

**Per iOS:**
- File `GoogleService-Info.plist` nella cartella `client/ios/`
- Configurazione Firebase nel progetto iOS

## 📱 Come Funziona

### Flusso Completo

1. **Utente apre l'app mobile**
   - L'app richiede il permesso per le notifiche push
   - Firebase genera un token FCM

2. **Token viene salvato**
   - Durante registrazione: `fcmToken` nel body → salvato automaticamente
   - Durante login: `fcmToken` nel body → salvato automaticamente
   - Manualmente: `POST /api/fcm-tokens` con `{ "token": "..." }`

3. **Utente attiva "Notifiche Demos"**
   - Nelle impostazioni, attiva la preferenza `demos: true`
   - Query: `UPDATE users SET notifiche_preferenze = jsonb_set(COALESCE(notifiche_preferenze, '{}'::jsonb), '{demos}', 'true'::jsonb) WHERE id = 'USER_ID'`

4. **Invio notifica**
   - Chiama `POST /api/comunicazioni/send-demos-notification`
   - Il sistema:
     - Crea comunicazione nella tabella `comunicazioni`
     - Trova utenti con `demos: true` e `fcm_tokens` non vuoto
     - Invia push notification a ogni token FCM
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
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "titolo": "Test Notifica",
    "messaggio": "Questo è un test"
  }'
```

## ⚠️ Problemi Comuni

### 1. Token FCM non salvati
**Sintomo:** Nessun utente ha token FCM nel database

**Soluzione:**
- Verifica che l'app mobile richieda i permessi notifiche
- Verifica che il token venga inviato durante login/registrazione
- Usa l'endpoint `POST /api/fcm-tokens` per salvare manualmente

### 2. Firebase Admin non configurato
**Sintomo:** `Firebase Admin non disponibile` nei log

**Soluzione:**
- Installa `firebase-admin`: `npm install firebase-admin`
- Aggiungi `serviceAccountKey.json` nel percorso corretto
- Verifica le variabili d'ambiente

### 3. Notifiche non arrivano
**Sintomo:** Notifiche inviate ma non ricevute sul cellulare

**Verifica:**
- Token FCM validi nel database
- Preferenza `demos: true` attiva
- Firebase Admin configurato correttamente
- App mobile configurata con Firebase
- Permessi notifiche concessi sul dispositivo

## 📊 Monitoraggio

### Log da controllare:
- `📤 Invio push notifications a X utenti...`
- `📱 Utente X: Y token(s) FCM`
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

1. ✅ Colonna `fcm_tokens` creata
2. ✅ Endpoint per salvare token creato
3. ✅ Salvataggio automatico durante login/registrazione
4. ⏳ Configurare Firebase Admin con `serviceAccountKey.json`
5. ⏳ Configurare app mobile con Firebase
6. ⏳ Testare invio notifiche push

