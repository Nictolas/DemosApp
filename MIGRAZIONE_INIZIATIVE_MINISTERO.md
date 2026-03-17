# Migrazione a iniziative_ministero

## Riepilogo

Ho aggiornato gli endpoint API per utilizzare la nuova tabella `iniziative_ministero` al posto delle tabelle separate `iniziative_popolari` e `referendum_abrogativi`.

## Modifiche Implementate

### 1. Funzioni Helper di Mapping (`api/utils/iniziativeMinisteroMapper.js`)

Creato un file di utility che gestisce il mapping tra la nuova struttura e il formato atteso dal frontend:

- **`mapToLegacyFormat()`**: Converte i record da `iniziative_ministero` al formato compatibile con il frontend
  - `titolo` → `nome`
  - `stato` → `esito` (con mapping degli stati)
  - `firme_raccolte` → `firme`
  - Aggiunge alias per compatibilità (`dataInizio`, `dataFine`, `sitoWeb`, etc.)

- **`buildQueryForTipo()`**: Costruisce query SQL per filtrare per tipo (`iniziativa` o `referendum`) con i filtri appropriati per ruolo utente

### 2. Endpoint Aggiornati

#### `/api/iniziative-popolari` (GET)
- ✅ Ora legge da `iniziative_ministero` con `tipo = 'iniziativa'`
- ✅ Mantiene la compatibilità con il frontend esistente
- ✅ Query di classifica aggiornata per usare la nuova tabella

#### `/api/referendum-abrogativi` (GET)
- ✅ Ora legge da `iniziative_ministero` con `tipo = 'referendum'`
- ✅ Mantiene la compatibilità con il frontend esistente
- ✅ Query di classifica aggiornata per usare la nuova tabella

#### `/api/iniziative-popolari/vota` (POST)
- ✅ Verifica che le iniziative esistano in `iniziative_ministero`
- ✅ Le tabelle `voti_iniziative_popolari` continuano a funzionare (riferiscono agli ID della nuova tabella)

#### `/api/referendum-abrogativi/vota` (POST)
- ✅ Verifica che i referendum esistano in `iniziative_ministero`
- ✅ Le tabelle `voti_referendum_abrogativi` continuano a funzionare (riferiscono agli ID della nuova tabella)

## Mapping dei Campi

### Da `iniziative_ministero` al formato legacy:

| Nuovo Campo | Campo Legacy | Note |
|------------|--------------|------|
| `titolo` | `nome` | Mappato automaticamente |
| `stato` | `esito` | Mapping: `in_corso` → `In Attesa`, etc. |
| `firme_raccolte` | `firme` | Mappato automaticamente |
| `quorum` | `quorum` | INTEGER nella nuova tabella, gestito come stringa per compatibilità |
| `sito_web` | `sito_web` / `sitoweb` / `sitoWeb` | Alias multipli per compatibilità |
| `data_inizio` | `data_inizio` / `dataInizio` | Alias per compatibilità |
| `data_fine` | `data_fine` / `dataFine` | Alias per compatibilità |
| `created_at` | `created_at` / `data_creazione` | Alias per compatibilità |

## Prossimi Passi

### ⚠️ IMPORTANTE: Migrazione Dati

**Prima di utilizzare in produzione**, devi migrare i dati esistenti:

1. **Migrare dati da `iniziative_popolari` a `iniziative_ministero`**:
   ```sql
   INSERT INTO iniziative_ministero (
     id, titolo, descrizione, tipo, stato, 
     data_inizio, data_fine, sito_web, quorum, 
     firme_raccolte, created_at, updated_at
   )
   SELECT 
     id, 
     nome as titolo, 
     descrizione, 
     'iniziativa' as tipo,
     CASE 
       WHEN esito = 'In Attesa' THEN 'in_corso'
       WHEN esito IS NULL THEN 'in_corso'
       ELSE LOWER(REPLACE(esito, ' ', '_'))
     END as stato,
     data_inizio, 
     data_fine, 
     COALESCE(sito_web, sitoweb) as sito_web,
     CASE 
       WHEN quorum = 'proposta' THEN 0
       WHEN quorum ~ '^[0-9]+$' THEN quorum::INTEGER
       ELSE 0
     END as quorum,
     COALESCE(firme, 0) as firme_raccolte,
     COALESCE(created_at, NOW()) as created_at,
     COALESCE(updated_at, NOW()) as updated_at
   FROM iniziative_popolari
   ON CONFLICT (id) DO NOTHING;
   ```

2. **Migrare dati da `referendum_abrogativi` a `iniziative_ministero`**:
   ```sql
   INSERT INTO iniziative_ministero (
     id, titolo, descrizione, tipo, stato, 
     data_inizio, data_fine, sito_web, quorum, 
     firme_raccolte, created_at, updated_at
   )
   SELECT 
     id, 
     nome as titolo, 
     descrizione, 
     'referendum' as tipo,
     CASE 
       WHEN esito = 'In Attesa' THEN 'in_corso'
       WHEN esito IS NULL THEN 'in_corso'
       ELSE LOWER(REPLACE(esito, ' ', '_'))
     END as stato,
     data_inizio, 
     data_fine, 
     COALESCE(sito_web, sitoweb) as sito_web,
     CASE 
       WHEN quorum = 'proposta' THEN 0
       WHEN quorum ~ '^[0-9]+$' THEN quorum::INTEGER
       ELSE 0
     END as quorum,
     COALESCE(firme, 0) as firme_raccolte,
     COALESCE(created_at, NOW()) as created_at,
     COALESCE(updated_at, NOW()) as updated_at
   FROM referendum_abrogativi
   ON CONFLICT (id) DO NOTHING;
   ```

### Note sulla Migrazione

1. **ID**: Gli ID esistenti vengono preservati, quindi i voti nelle tabelle `voti_iniziative_popolari` e `voti_referendum_abrogativi` continueranno a funzionare.

2. **Proposte Utente**: Se le tabelle vecchie hanno proposte utente (`quorum = 'proposta'`), queste verranno migrate con `quorum = 0`. Potresti voler gestire diversamente le proposte utente nella nuova struttura.

3. **Test**: Dopo la migrazione, testa accuratamente:
   - Visualizzazione iniziative popolari
   - Visualizzazione referendum abrogativi
   - Votazione iniziative
   - Votazione referendum
   - Classifiche

## Compatibilità

✅ **Il frontend non richiede modifiche** - tutti i dati vengono mappati al formato atteso.

✅ **Le tabelle dei voti continuano a funzionare** - usano gli stessi ID.

⚠️ **Le tabelle vecchie (`iniziative_popolari` e `referendum_abrogativi`) possono essere mantenute per backup**, ma non sono più utilizzate dagli endpoint principali.

## Domande o Problemi?

Se durante la migrazione o i test riscontri problemi, verifica:
1. Che la tabella `iniziative_ministero` esista e abbia la struttura corretta
2. Che i dati siano stati migrati correttamente
3. Che gli ID nelle tabelle dei voti corrispondano agli ID nella nuova tabella
4. I log del server per eventuali errori SQL

