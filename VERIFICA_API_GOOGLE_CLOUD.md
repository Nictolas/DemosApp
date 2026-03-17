# 🔍 Verifica API Google Cloud per FCM

## ✅ VAPID Key Verificata

La VAPID key esatta è:
```
(la tua VAPID key completa)
```

## ❌ Problema Persistente: Errore 401

Anche con la VAPID key corretta, l'errore 401 persiste. Questo indica che il problema potrebbe essere:

1. **Cloud Messaging API non abilitata** in Google Cloud Console
2. **Permessi del progetto** non corretti
3. **Configurazione del progetto Firebase** incompleta

## ✅ Soluzione: Verifica e Abilita API

### Passo 1: Verifica API in Google Cloud Console

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto **demos-finale** (o il progetto corretto)
3. Vai su **APIs & Services** → **Enabled APIs** (o **API abilitate**)
4. Cerca **"Firebase Cloud Messaging API"** o **"FCM API"**

### Passo 2: Abilita API se Non Presente

Se l'API non è abilitata:

1. Clicca su **"+ ENABLE APIS AND SERVICES"** (o **"+ ABILITA API E SERVIZI"**)
2. Cerca **"Firebase Cloud Messaging API"**
3. Clicca sul risultato
4. Clicca su **"Enable"** (o **"Abilita"**)
5. Attendi qualche minuto per la propagazione

### Passo 3: Verifica Permessi Service Account

1. In Google Cloud Console, vai su **IAM & Admin** → **Service Accounts**
2. Cerca il service account di Firebase (dovrebbe essere `firebase-adminsdk-...@demos-finale.iam.gserviceaccount.com`)
3. Verifica che abbia i permessi:
   - **Firebase Cloud Messaging Admin**
   - O almeno **Editor** o **Owner**

### Passo 4: Verifica Configurazione Progetto

1. Vai su [Firebase Console](https://console.firebase.google.com/)
2. Seleziona il progetto **DEMOS-finale**
3. Vai su **Impostazioni progetto** → **Generale**
4. Verifica che:
   - Il **Project ID** sia `demos-finale`
   - Il **Project number** corrisponda a quello in Google Cloud Console

## 🧪 Test Dopo l'Abilitazione

Dopo aver abilitato le API:

1. **Attendi 2-5 minuti** per la propagazione
2. **Rideploya il frontend** (per sicurezza)
3. **Apri la webapp** e controlla la console
4. **Dovresti vedere**:
   ```
   ✅ Token FCM ottenuto: (token lungo, NON web_...)
   ```
5. **Esegui il test completo**:
   ```bash
   node test-fcm-completo.cjs
   ```

## 📝 Note Importanti

- Le API devono essere abilitate in **Google Cloud Console**, non solo in Firebase Console
- Dopo aver abilitato le API, potrebbe volerci qualche minuto per la propagazione
- Se il progetto Firebase è collegato a un progetto Google Cloud diverso, verifica che sia quello corretto

## 🔄 Se il Problema Persiste

Se dopo aver abilitato le API l'errore persiste:

1. **Verifica che il progetto Google Cloud corrisponda** a quello Firebase
2. **Verifica i permessi** del service account
3. **Controlla i log** in Google Cloud Console per eventuali errori
4. **Prova a rigenerare la VAPID key** in Firebase Console (come ultima risorsa)

