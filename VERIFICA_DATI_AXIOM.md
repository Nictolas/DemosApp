# Verifica Dati su Axiom Dashboard

## Come verificare se i dati sono stati migrati

### 1. Vai su Axiom Dashboard
- URL: https://app.axiom.co/demos-institute-jrim/datasets/centralized_logs

### 2. Controlla se ci sono dati
- Clicca su "Open in Query" (in alto a destra)
- Esegui questa query semplice:
  ```
  ['centralized_logs']
  ```
- Se vedi risultati, i dati sono stati migrati con successo!

### 3. Se non vedi dati
- Controlla il range temporale (in alto nella query)
- Imposta un range ampio (es. ultimi 7 giorni o tutto il tempo)
- I dati potrebbero essere stati inviati con timestamp vecchi

### 4. Verifica il dataset "real-time" per audit logs
- URL: https://app.axiom.co/demos-institute-jrim/datasets/real-time
- Esegui la stessa query: `['real-time']`

## Note
- I dati potrebbero richiedere qualche minuto per essere indicizzati
- Se vedi i campi nel dataset (come mostrato nello screenshot), il dataset esiste
- Se non vedi dati, potrebbe essere un problema di indicizzazione o di formato timestamp

