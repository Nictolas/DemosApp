# ✅ Verifica VAPID Key

## VAPID Key da Firebase Console

Dalla schermata Firebase Console, la VAPID key è:
```
BIHJ29xtgACTWOTrdApZa1XsV-h7Lla5qoxah13RtkWHCKU_UJLWO4vMeXeMhvpz7XEFhas-r5t4uuhLsAcOoBw
```

## ⚠️ IMPORTANTE: Verifica Corrispondenza

**Verifica che la VAPID key su Render.com sia ESATTAMENTE uguale a quella in Firebase Console:**

1. Vai su **Render.com → `demos-frontend` → Environment**
2. Trova `VITE_FIREBASE_VAPID_KEY`
3. Clicca sull'icona dell'occhio per vedere il valore completo
4. Confronta carattere per carattere con quella in Firebase Console

**La chiave deve essere identica, altrimenti non funzionerà!**

## 🔄 Passo Successivo: Rideploy Frontend

**DOPO aver verificato che la VAPID key è corretta su Render.com:**

1. Vai su **Render.com → `demos-frontend` → Manual Deploy**
2. Clicca **"Deploy latest commit"**
3. Oppure fai un commit e push (se auto-deploy è attivo)

**IMPORTANTE**: Le variabili `VITE_*` sono disponibili SOLO durante il build. Se le hai aggiunte/modificate dopo l'ultimo deploy, devi fare un nuovo deploy!

## 🧪 Verifica Dopo il Deploy

Dopo il deploy, apri la webapp e controlla la console del browser:

✅ **Dovresti vedere:**
```
🔧 Configurazione Firebase FCM: {
  projectId: "demos-finale",
  messagingSenderId: "848085963511",
  apiKey: "AIzaSyA13...",
  vapidKey: "PRESENTE"
}
✅ Firebase Messaging inizializzato per web push
🔑 VAPID Key check: Presente (BIHJ29xtgACTW...)
🔐 Tentativo di ottenere token FCM con VAPID key...
✅ Token FCM ottenuto: (token lungo, NON web_...)
```

❌ **Se vedi ancora:**
- `vapidKey: "MANCANTE"` → Il frontend non è stato rideployato dopo aver aggiunto la variabile
- `Request is missing required authentication credential` → La VAPID key non è corretta o non corrisponde a quella in Firebase Console

## 📝 Note

- La VAPID key è una chiave pubblica, quindi può essere visibile nel codice
- Ma deve essere ESATTAMENTE quella generata in Firebase Console
- Anche un solo carattere diverso farà fallire l'autenticazione

