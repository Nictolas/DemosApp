# Allineamento Tabelle Legacy a iniziative_ministero

## Obiettivo

Standardizzare le tabelle `iniziative_popolari`, `referendum_abrogativi`, `voti_iniziative_popolari` e `voti_referendum_abrogativi` per renderle compatibili con `iniziative_ministero`.

## Strategia

### 1. Approccio Non-Distruttivo
- **Aggiungiamo** colonne standardizzate senza rimuovere quelle esistenti
- Manteniamo la retrocompatibilità con il codice esistente
- Migriamo i dati dalle colonne vecchie alle nuove

### 2. Colonne Standardizzate

#### iniziative_popolari e referendum_abrogativi
Aggiungiamo colonne che corrispondono a `iniziative_ministero`:

| Colonna Vecchia | Colonna Nuova (Standard) | Tipo | Note |
|----------------|------------------------|------|------|
| `nome` | `titolo` | TEXT | Alias sincronizzato via trigger |
| `status` | `stato` | VARCHAR(50) | Mappato da status |
| `quorum` | `quorum_raggiunto` | BOOLEAN | Convertito da quorum stringa |
| `firme` | `firme_raccolte` | INTEGER | Copiato direttamente |
| - | `esito` | VARCHAR(100) | Calcolato da status/quorum |
| - | `tipo` | VARCHAR(50) | 'iniziativa' o 'referendum' |
| - | `data_ultimo_aggiornamento` | TIMESTAMP | Timestamp di aggiornamento |

#### voti_iniziative_popolari e voti_referendum_abrogativi
- `iniziativa_id` / `referendum_id`: già TEXT/VARCHAR, compatibile
- `userid`: già UUID, compatibile
- Aggiungiamo indici per migliorare le performance

### 3. Mapping dei Valori

#### stato (da status)
- `pending`, `in attesa`, `in_corso` → `in_corso`
- `conclusa`, `completed` → `conclusa`
- `approvata`, `approved` → `conclusa`
- `rifiutata`, `rejected` → `conclusa`

#### quorum_raggiunto (da quorum)
- `'ok'` o `'OK'` → `true`
- `'proposta'` → `false`
- Numero > 0 → `true`
- Altro → `false`

#### esito (da status/quorum)
- `quorum = 'ok'` → `'Approvata'`
- `status = 'approvata'` → `'Approvata'`
- `status = 'rifiutata'` → `'Rifiutata'`
- `status = 'conclusa'` → `'Conclusa'`
- Altro → `'In Attesa'`

### 4. Trigger di Sincronizzazione

Trigger automatici mantengono sincronizzate:
- `nome` ↔ `titolo` (bidirezionale)
- Le colonne vecchie e nuove rimangono allineate

## Esecuzione

### Step 1: Backup
```sql
-- Crea backup delle tabelle prima della migrazione
CREATE TABLE iniziative_popolari_backup AS SELECT * FROM iniziative_popolari;
CREATE TABLE referendum_abrogativi_backup AS SELECT * FROM referendum_abrogativi;
```

### Step 2: Esegui lo script
```bash
psql $DATABASE_URL -f database/align-tables-to-ministero.sql
```

### Step 3: Verifica
```sql
-- Verifica che le colonne siano state aggiunte
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('iniziative_popolari', 'referendum_abrogativi')
ORDER BY table_name, ordinal_position;

-- Verifica che i dati siano stati migrati
SELECT COUNT(*) as totale,
       COUNT(titolo) as con_titolo,
       COUNT(stato) as con_stato,
       COUNT(quorum_raggiunto) as con_quorum_raggiunto
FROM iniziative_popolari;
```

## Vantaggi

1. **Retrocompatibilità**: Il codice esistente continua a funzionare
2. **Standardizzazione**: Le nuove query possono usare nomi standard
3. **Flessibilità**: Possiamo migrare gradualmente il codice
4. **Performance**: Indici aggiunti migliorano le query

## Prossimi Passi

Dopo l'esecuzione dello script:

1. **Aggiornare il codice** per usare preferibilmente le colonne standardizzate
2. **Testare** che tutto funzioni correttamente
3. **Monitorare** le performance
4. **In futuro** (opzionale): rimuovere le colonne vecchie dopo migrazione completa

## Rollback

Se necessario, usa `align-tables-to-ministero-rollback.sql` per rimuovere le modifiche.

**ATTENZIONE**: Il rollback rimuove le colonne aggiunte, quindi i dati migrati andranno persi se non sono stati salvati anche nelle colonne vecchie.

