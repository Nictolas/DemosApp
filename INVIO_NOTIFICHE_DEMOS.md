# 📢 Invio Notifiche "Notifiche Demos"

## Panoramica

Sistema per inviare notifiche push "Notifiche Demos" a tutti gli utenti che hanno attivato questa preferenza.

## Endpoint API

### POST `/api/comunicazioni/send-demos-notification`

Invia una notifica push "Notifiche Demos" a tutti gli utenti che hanno `notifiche_preferenze->>'demos' = 'true'`.

#### Richiesta

```json
{
  "titolo": "Titolo della notifica",
  "messaggio": "Messaggio opzionale (se non fornito, usa il titolo)"
}
```

#### Esempio con cURL

```bash
curl -X POST https://www.demos.community/api/comunicazioni/send-demos-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REDACTED_TOKEN>" \
  -d '{
    "titolo": "Notifiche Demos",
    "messaggio": "Nuova comunicazione disponibile!"
  }'
```

#### Esempio con JavaScript/Fetch

```javascript
const response = await fetch('https://www.demos.community/api/comunicazioni/send-demos-notification', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    titolo: 'Notifiche Demos',
    messaggio: 'Nuova comunicazione disponibile!'
  })
});

const result = await response.json();
console.log(result);
```

#### Risposta di Successo

```json
{
  "success": true,
  "message": "Notifica \"Notifiche Demos\" inviata con successo",
  "data": {
    "titolo": "Notifiche Demos",
    "messaggio": "Nuova comunicazione disponibile!",
    "destinatari": "Tutti gli utenti con notifiche Demos attivate"
  }
}
```

#### Risposta di Errore

```json
{
  "success": false,
  "error": "Titolo richiesto"
}
```

## Comportamento

1. **Filtro Utenti**: La notifica viene inviata SOLO agli utenti che hanno:
   - `notifiche_preferenze->>'demos' = 'true'` (esplicitamente attivo, non NULL)
   - `fcm_tokens` non vuoto (almeno un token FCM registrato)
   - `status = 'active'` o `status IS NULL`

2. **Notifiche In-App**: Vengono create notifiche in-app per tutti gli utenti attivi (indipendentemente dalla preferenza push).

3. **Push Notifications**: Vengono inviate solo agli utenti con preferenza attiva e token FCM validi.

4. **Link di Destinazione**: Quando l'utente clicca sulla notifica, viene aperto `https://www.demos.community/comunica`.

5. **Pulizia Token**: I token FCM non validi vengono automaticamente rimossi dal database.

## Note Tecniche

- Il sistema usa Firebase Cloud Messaging (FCM) per le notifiche push
- Le notifiche supportano Web, Android e iOS
- I token non validi vengono automaticamente rimossi per mantenere il database pulito
- Le notifiche vengono inviate in batch per ottimizzare le performance

## Verifica

Dopo l'invio, controlla i log del server per vedere:
- Numero di utenti con preferenza attiva
- Numero di notifiche push inviate con successo
- Numero di fallimenti (token non validi, ecc.)

