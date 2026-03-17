# 🔧 Soluzione Token FCM Non Registrato

## ❌ Problema Identificato

L'errore `messaging/registration-token-not-registered` indica che il token FCM salvato nel database non è registrato con Firebase.

**Possibili cause:**
1. Token duplicati o vecchi nel database
2. Token generato ma non registrato correttamente
3. Token scaduto o revocato
4. Token generato per un progetto Firebase diverso

## ✅ Soluzione

### Passo 1: Pulisci i Token Vecchi

I token FCM nel database potrebbero essere vecchi o duplicati. Dobbiamo rimuoverli e far rigenerare un nuovo token.

**Opzione A: Rimuovi tutti i token (Consigliato)**
```sql
UPDATE users SET fcm_tokens = ARRAY[]::TEXT[] WHERE fcm_tokens IS NOT NULL;
```

**Opzione B: Rimuovi solo i token di un utente specifico**
```sql
UPDATE users 
SET fcm_tokens = ARRAY[]::TEXT[]
WHERE email = 'nicolasmicheletti90@gmail.com';
```

### Passo 2: Rigenera il Token

Dopo aver pulito i token:

1. **Apri la webapp** su https://www.demos.community
2. **Apri la console del browser** (F12)
3. **Cancella la cache del browser** (Ctrl+Shift+Delete)
4. **Ricarica la pagina** con Ctrl+Shift+R
5. **Concedi i permessi** per le notifiche se richiesto
6. **Verifica nella console** che vedi:
   ```
   ✅ Token FCM ottenuto: (nuovo token)
   ✅ Token FCM sincronizzato con successo
   ```

### Passo 3: Verifica il Nuovo Token

Dopo aver rigenerato il token:

1. **Esegui il test**:
   ```bash
   node test-invio-notifica-push.cjs
   ```
2. **Verifica** che il nuovo token funzioni
3. **Prova a inviare una notifica** da https://www.demos.community/comunica

## 🔍 Verifica Token nel Database

Dopo aver rigenerato, verifica che ci sia un solo token valido:

```sql
SELECT 
  id,
  email,
  fcm_tokens,
  array_length(fcm_tokens, 1) as token_count
FROM users 
WHERE email = 'nicolasmicheletti90@gmail.com';
```

Dovresti vedere:
- **1 token FCM reale** (lungo, ~142 caratteri)
- **Nessun token duplicato**

## 📝 Note Importanti

- I token FCM possono scadere o essere revocati
- Se un utente revoca i permessi per le notifiche, il token diventa invalido
- I token duplicati possono causare problemi
- È meglio avere un solo token valido per utente

## 🔄 Se il Problema Persiste

Se dopo aver pulito e rigenerato il token il problema persiste:

1. **Verifica che il progetto Firebase sia corretto** (`demos-finale`)
2. **Verifica che la VAPID key sia corretta**
3. **Verifica che le API siano abilitate** in Google Cloud Console
4. **Prova a rigenerare la VAPID key** in Firebase Console

