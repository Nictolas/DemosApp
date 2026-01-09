# Flusso Completo: Generazione Spiegazione

## Cosa Dovrebbe Succedere Quando Clicchi su "Genera Spiegazione"

### 1. **FRONTEND - Click sul Pulsante**
- Il pulsante "Genera" viene disabilitato
- Appare un loader (spinner) accanto al pulsante
- Viene chiamata la funzione `generaSpiegazioneMutation.mutate(votazione.politico_nome)`

### 2. **FRONTEND - Chiamata API**
- Viene fatta una richiesta POST a: `/api/voti-camera/${encodeURIComponent(politicoNome)}/spiegazione`
- Esempio: `POST /api/voti-camera/Erica%20Mazzetti/spiegazione`
- La richiesta include il token di autenticazione nell'header `Authorization: Bearer <token>`

### 3. **BACKEND - Verifica Autenticazione**
- Il middleware `verifyToken` verifica che il token sia valido
- Se il token non è valido → **401 Unauthorized**

### 4. **BACKEND - Verifica Ruolo Admin**
- Estrae il token dall'header
- Verifica il JWT e ottiene l'ID utente
- Controlla se l'utente ha ruolo `'admin'` o `'AD'`
- Se non è admin → **403 Forbidden** con messaggio "Solo gli amministratori possono generare spiegazioni"

### 5. **BACKEND - Recupero Dati Politico**
- Query al database per trovare il politico in `voti_camera`
- JOIN con `votazioni_parlamento` per ottenere i dettagli della votazione
- Se il politico non esiste → **404 Not Found**
- Se il politico esiste ma non ha `votazione_id` → **404 Not Found** con messaggio "Esegui prima una sincronizzazione"

### 6. **BACKEND - Verifica Spiegazione Esistente**
- Controlla se esiste già una spiegazione per questa votazione
- Se esiste → **200 OK** con la spiegazione esistente (non rigenera)

### 7. **BACKEND - Verifica Limite Giornaliero**
- Controlla quante spiegazioni sono state generate oggi
- Se si usa Groq → nessun limite (gratuito)
- Se si usa OpenAI → limite configurabile (default: 50 al giorno)
- Se limite raggiunto → **429 Too Many Requests**

### 8. **BACKEND - Generazione Spiegazione AI**
- Chiama `generaSpiegazioneVotazione(votazione_id, titolo_votazione, descrizione_votazione, camera)`
- Verifica se l'API AI è configurata (`GROQ_API_KEY` o `OPENAI_API_KEY`)
- Se non configurata → **500 Internal Server Error** con messaggio appropriato
- Costruisce il prompt con:
  - Titolo votazione
  - Descrizione completa (se disponibile)
  - Camera (Camera/Senato)
- Chiama l'API AI (Groq o OpenAI)
- Riceve la spiegazione generata

### 9. **BACKEND - Salvataggio Spiegazione**
- Salva la spiegazione nella tabella `votazioni_parlamento`
- UPDATE sulla colonna `spiegazione` per il `votazione_id` corrispondente
- Aggiorna `updated_at`

### 10. **BACKEND - Risposta al Frontend**
- **200 OK** con JSON:
```json
{
  "success": true,
  "message": "Spiegazione generata con successo",
  "data": {
    "politico_nome": "Erica Mazzetti",
    "spiegazione": "La spiegazione generata..."
  }
}
```

### 11. **FRONTEND - Gestione Successo**
- `onSuccess` della mutation viene chiamato
- Mostra toast di successo: "Spiegazione generata - La spiegazione è stata generata con successo"
- Invalida la query `/api/voti-camera` per forzare il refetch
- Dopo 2 secondi, chiama `refetch()` per aggiornare i dati
- La tabella si aggiorna e mostra la nuova spiegazione

### 12. **FRONTEND - Gestione Errore**
- Se la risposta non è OK → `onError` viene chiamato
- Mostra toast di errore con il messaggio dell'errore
- Il pulsante viene riabilitato

---

## Possibili Problemi e Soluzioni

### Problema 1: "Non succede nulla"
**Causa**: L'errore viene catturato ma non mostrato correttamente
**Soluzione**: Verificare i log del browser console e del server

### Problema 2: Errore 500
**Cause possibili**:
- API key non configurata (`GROQ_API_KEY` o `OPENAI_API_KEY`)
- Errore nella chiamata all'API AI
- Errore nel database
**Soluzione**: Controllare i log del server per vedere l'errore esatto

### Problema 3: Errore 403
**Causa**: L'utente non è admin
**Soluzione**: Verificare che l'utente abbia ruolo `'admin'` o `'AD'`

### Problema 4: Errore 404
**Cause possibili**:
- Il politico non esiste in `voti_camera`
- Il politico non ha `votazione_id` (non è stata fatta la sincronizzazione)
**Soluzione**: Eseguire la sincronizzazione prima di generare spiegazioni

### Problema 5: Il loader non appare
**Causa**: Il frontend non gestisce correttamente lo stato `isPending`
**Soluzione**: Verificare che il pulsante mostri il loader quando `generaSpiegazioneMutation.isPending === true`
