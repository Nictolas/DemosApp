# Sincronizzazione Voti da Openpolis

Questo script sincronizza le ultime votazioni dei deputati della Camera da Openpolis e le salva nella tabella `voti_camera`.

## Utilizzo

### Opzione 1: Con file JSON dei deputati (Consigliato)

1. Crea un file JSON con la lista dei deputati. Esempio: `deputati.json`
```json
[
  {
    "nome": "Giorgia",
    "cognome": "Meloni",
    "id": "12345",
    "ruolo": "P",
    "grado_elezione": "C"
  },
  {
    "nome": "Elly",
    "cognome": "Schlein",
    "id": "12346",
    "ruolo": "P",
    "grado_elezione": "C"
  }
]
```

2. Esegui lo script:
```bash
node sync-voti-openpolis.js deputati.json
```

### Opzione 2: Recupero automatico

Lo script proverà a recuperare automaticamente la lista dei deputati da Openpolis:
```bash
node sync-voti-openpolis.js
```

**Nota**: Se il recupero automatico non funziona, usa l'Opzione 1 con un file JSON.

## Come ottenere gli ID dei deputati

1. Vai su https://parlamento19.openpolis.it
2. Cerca un deputato
3. Apri la sua pagina (es: https://parlamento19.openpolis.it/politico/giorgia-meloni/12345)
4. L'ID è l'ultimo numero nell'URL

## Struttura dati

Lo script salva nella tabella `voti_camera`:
- `politico_nome`: Nome completo del deputato
- `data_votazione`: Data della votazione (se disponibile)
- `oggetto_voto`: Titolo/descrizione della votazione
- `esito_voto`: Favorevole/Contrario/Indeciso

## Note

- Lo script normalizza i voti in: "Favorevole", "Contrario", "Indeciso"
- Se un deputato ha già un record, viene aggiornato con l'ultima votazione
- Lo script fa una pausa di 500ms tra ogni deputato per non sovraccaricare il server


