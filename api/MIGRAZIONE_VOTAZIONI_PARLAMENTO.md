# Migrazione a Tabella Separata per Votazioni

## 🎯 Obiettivo

Ristrutturare il database per avere:
- **Una tabella `votazioni_parlamento`** con UNA spiegazione AI per ogni votazione (condivisa da tutti i politici)
- **Tabella `voti_camera`** modificata con `votazione_id` (FK) invece di duplicare i dati

## 📋 Passi per la Migrazione

### Step 1: Crea la tabella votazioni_parlamento

Esegui nel Neon Console:

```sql
-- File: create-votazioni-parlamento-table.sql
-- (Vedi il contenuto completo nel file)
```

Oppure esegui direttamente il file SQL.

### Step 2: Aggiungi colonna votazione_id a voti_camera

Esegui nel Neon Console:

```sql
ALTER TABLE voti_camera 
ADD COLUMN IF NOT EXISTS votazione_id INTEGER REFERENCES votazioni_parlamento(id) ON DELETE SET NULL;
```

### Step 3: Migra i dati esistenti

Esegui nel Neon Console il file `migrate-voti-camera-to-votazioni-parlamento.sql`:

```sql
-- Questo script:
-- 1. Crea votazioni_parlamento dai dati esistenti (DISTINCT per evitare duplicati)
-- 2. Aggiorna voti_camera con i votazione_id corrispondenti
-- 3. Crea gli indici necessari
```

### Step 4: Verifica la migrazione

```sql
-- Controlla quante votazioni uniche sono state create
SELECT COUNT(*) FROM votazioni_parlamento;

-- Controlla quanti politici hanno votazione_id
SELECT COUNT(*) FROM voti_camera WHERE votazione_id IS NOT NULL;

-- Verifica che le spiegazioni siano state migrate
SELECT COUNT(*) FROM votazioni_parlamento WHERE spiegazione IS NOT NULL;
```

## ✅ Vantaggi della Nuova Struttura

1. **Efficienza**: Una sola spiegazione AI per votazione invece di N (dove N = numero di politici)
2. **Consistenza**: Tutti i politici vedono la stessa spiegazione per la stessa votazione
3. **Risparmio**: Se 10 politici votano la stessa votazione, generi 1 spiegazione invece di 10
4. **Manutenibilità**: Più facile aggiornare/rigenerare spiegazioni

## 🔄 Dopo la Migrazione

1. **Esegui una nuova sincronizzazione** per popolare `votazioni_parlamento` con i nuovi dati
2. **Le spiegazioni esistenti** verranno migrate automaticamente
3. **Le nuove spiegazioni** verranno generate nella tabella `votazioni_parlamento`

## ⚠️ Note Importanti

- La colonna `votazione` in `voti_camera` può essere rimossa in futuro (ora è ridondante)
- La colonna `descrizione_votazione` in `voti_camera` può essere rimossa (ora è in `votazioni_parlamento`)
- La colonna `spiegazione` in `voti_camera` può essere rimossa (ora è in `votazioni_parlamento`)

## 🧹 Pulizia Opzionale (Dopo Verifica)

Dopo aver verificato che tutto funziona, puoi rimuovere le colonne obsolete:

```sql
-- ATTENZIONE: Esegui solo dopo aver verificato che tutto funziona!
ALTER TABLE voti_camera DROP COLUMN IF EXISTS votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS descrizione_votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS spiegazione;
```
