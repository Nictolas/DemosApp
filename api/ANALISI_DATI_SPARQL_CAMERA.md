# Analisi Dati Disponibili - Endpoint SPARQL Camera dei Deputati

## 📊 Dati Disponibili

### ✅ Cosa è possibile ottenere:

1. **Votazioni della XIX Legislatura**
   - **Filtro**: Votazioni con "vs19" nel nome identificativo
   - **Dati disponibili per ogni votazione**:
     - **ID Votazione**: Identificativo univoco (es. `vs19_590_001`)
     - **Descrizione/Label**: Titolo/descrizione della votazione (es. "Votazione finale")
     - **Esito**: Approvato (1) o Non Approvato (0)
     - **Seduta**: Riferimento alla seduta (es. `s19_590`)
     - **URI**: URI completo della risorsa SPARQL

2. **Collegamenti**
   - Votazioni → Sedute (tramite `rif_seduta`)

### ❌ Cosa NON è disponibile:

1. **Voti dei singoli politici**
   - L'endpoint SPARQL pubblico **NON espone** i voti dei singoli deputati
   - Non è possibile sapere quale politico ha votato cosa tramite questo endpoint
   - Per ottenere questi dati sarebbe necessario:
     - Accedere a fonti alternative (API private, database interni)
     - Utilizzare altri endpoint o servizi della Camera
     - Scraping da fonti pubbliche alternative

2. **Informazioni dettagliate sull'atto**
   - Sigla atto, numero atto, tipo atto non sono disponibili direttamente
   - Alcune informazioni potrebbero essere nel label, ma non strutturate

3. **Data della votazione**
   - La data non è disponibile direttamente nella struttura SPARQL
   - Potrebbe essere dedotta dalla seduta, ma richiede query aggiuntive

4. **Legislatura esplicita**
   - Il numero di legislatura non è disponibile come predicato diretto
   - Viene dedotto dal nome della votazione (vs19 = XIX legislatura)

## 🔍 Struttura Dati

### Predicati disponibili per le votazioni:
- `rdfs:label` → Descrizione/titolo della votazione
- `ocd:approvato` → 1 (Approvato) o 0 (Non Approvato)
- `ocd:rif_seduta` → Riferimento alla seduta

### Esempio di votazione:
```
URI: http://dati.camera.it/ocd/votazione.rdf/vs19_590_001
Label: "Votazione finale"
Approvato: 1
Seduta: http://dati.camera.it/ocd/seduta.rdf/s19_590
```

## 💡 Raccomandazioni

1. **Per i dati attuali**: La query è configurata per recuperare solo votazioni della XIX legislatura (vs19)

2. **Per i voti dei politici**: 
   - Verificare se esistono altri endpoint della Camera
   - Controllare se ci sono API alternative
   - Considerare l'accesso a database interni o fonti ufficiali

3. **Per dati più completi**:
   - Potrebbe essere necessario combinare più fonti
   - Verificare se ci sono file CSV o altri formati disponibili sul sito della Camera

## 📝 Note Tecniche

- Endpoint: `http://dati.camera.it/sparql`
- Metodo: GET (con parametri query)
- Formato risposta: JSON (application/sparql-results+json)
- Limitazioni: L'endpoint pubblico espone solo dati limitati

