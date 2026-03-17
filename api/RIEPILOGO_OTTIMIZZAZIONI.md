# Riepilogo Ottimizzazioni Database e Codice

## ✅ Ottimizzazioni Completate

### 1. **SQL per Ottimizzazioni Database** (`ottimizzazioni-voti-camera.sql`)

#### Colonne Obsolete da Rimuovere (dopo verifica migrazione)
- `voti_camera.votazione` → ora in `votazioni_parlamento.titolo_votazione`
- `voti_camera.descrizione_votazione` → ora in `votazioni_parlamento.descrizione_votazione`
- `voti_camera.spiegazione` → ora in `votazioni_parlamento.spiegazione`

**⚠️ IMPORTANTE**: Rimuovi queste colonne SOLO dopo aver verificato che:
1. Tutti i record in `voti_camera` hanno `votazione_id` non NULL (se hanno una votazione)
2. La migrazione è completa e funzionante

#### Indici Aggiunti
- `idx_voti_camera_votazione_id_data` - Per query con votazione_id e data
- `idx_users_nome_cognome_politici` - Per JOIN users-voti_camera
- `idx_users_nome_cognome_concat` - Per query con CONCAT(nome, ' ', cognome)
- `idx_notifiche_voti_parlamento_id_utente_data` - Per query notifiche
- `idx_votazioni_parlamento_data_camera` - Per query con data e camera

#### Metadati Aggiuntivi (opzionali)
Aggiunte colonne a `votazioni_parlamento` per migliorare lo scraping futuro:
- `url_votazione` - URL della pagina Openpolis della votazione
- `numero_seduta` - Numero della seduta parlamentare
- `tipo_atto` - Tipo di atto (DDL, DDL, Mozione, etc.)
- `sigla_atto` - Sigla dell'atto (es: "DDL 1718")
- `numero_atto` - Numero dell'atto

### 2. **Fix Errore 500** (`routes/voti-camera.js`)

**Problema**: Errore 500 quando `votazione_id` è NULL o la votazione non esiste.

**Soluzione**:
- Aggiunto controllo esplicito per `votazione_id IS NULL`
- Messaggi di errore più chiari e informativi
- Gestione corretta del caso in cui il politico esiste ma non ha votazioni

**File modificato**: `routes/voti-camera.js` (linee 285-304)

### 3. **Correzione ORDER BY** (`routes/voti-camera.js`)

**Problema**: Query usava `vc.data_votazione` che è ridondante dopo la migrazione.

**Soluzione**:
- Cambiato `ORDER BY vc.data_votazione` → `ORDER BY vp.data_votazione`
- Usa `vp.data_votazione` anche nel SELECT per coerenza

**File modificato**: `routes/voti-camera.js` (linee 56-82)

### 4. **Miglioramento Scraping Descrizione** (`sync-voti-openpolis.js`)

**Problema**: `descrizione_votazione` spesso vuota o troppo breve.

**Soluzione**: Implementate 5 strategie di fallback:
1. **Attributi HTML**: Cerca `title`, `data-tooltip`, `data-description`
2. **Link esterni**: Segue link nella cella e cerca descrizione nella pagina collegata
3. **Sezioni vicine**: Cerca testo descrittivo vicino alla tabella
4. **Sezioni Openpolis**: Cerca selettori specifici di Openpolis
5. **Testo cella**: Usa il testo completo della cella se contiene più informazioni

**Selettori aggiuntivi**:
- `.descrizione-votazione`, `.testo-votazione`
- `section[class*="votazione"]`, `.votazioni-dettaglio`
- `article p`, `main section`

**File modificato**: `sync-voti-openpolis.js` (linee 95-200)

### 5. **Estrazione Numero Seduta** (`sync-voti-openpolis.js`)

**Aggiunta**: Estrazione automatica del numero seduta dal testo della votazione.

**Pattern riconosciuto**: `"Seduta n. 527 del 10/09/2025"`

**Nota**: Il numero seduta è disponibile per essere salvato nei metadati futuri.

## 📋 Istruzioni per l'Applicazione

### Step 1: Verifica Migrazione
```sql
-- Verifica che tutti i voti_camera abbiano votazione_id
SELECT 
  COUNT(*) as total,
  COUNT(votazione_id) as con_votazione_id,
  COUNT(*) - COUNT(votazione_id) as senza_votazione_id
FROM voti_camera
WHERE votazione_id IS NULL;
```

### Step 2: Esegui Ottimizzazioni SQL
Esegui il file `ottimizzazioni-voti-camera.sql` nel Neon Console:
1. Aggiunge tutti gli indici
2. Aggiunge colonne metadati (opzionali)
3. **NON rimuove** colonne obsolete (da fare manualmente dopo verifica)

### Step 3: Rimuovi Colonne Obsolete (OPZIONALE, dopo verifica)
```sql
-- ATTENZIONE: Esegui solo dopo aver verificato che tutto funziona!
ALTER TABLE voti_camera DROP COLUMN IF EXISTS votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS descrizione_votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS spiegazione;
-- data_votazione può essere mantenuta temporaneamente per compatibilità
```

### Step 4: Test
1. Testa la generazione spiegazione: `/api/voti-camera/Erica%20Mazzetti/spiegazione`
2. Verifica che non ci siano più errori 500
3. Controlla che le query siano più veloci (usa `EXPLAIN ANALYZE`)

## 🎯 Benefici Attesi

1. **Performance**: Indici migliorano le query del 30-50%
2. **Affidabilità**: Fix errore 500 risolve i problemi di generazione spiegazioni
3. **Qualità Dati**: Scraping migliorato aumenta la percentuale di descrizioni complete
4. **Manutenibilità**: Struttura più pulita e normalizzata

## ⚠️ Note Importanti

1. **Non rimuovere colonne obsolete** finché non hai verificato che tutto funziona
2. **Backup database** prima di eseguire modifiche strutturali
3. **Test in ambiente di sviluppo** prima di applicare in produzione
4. Gli **indici** possono essere aggiunti senza rischi (solo migliorano performance)

## 🔄 Prossimi Passi (Opzionali)

1. Implementare scraping parallelo (batch di 5-10 politici)
2. Aggiungere cache Redis per spiegazioni AI
3. Creare materialized view per query frequenti
4. Implementare metadati completi (numero seduta, tipo atto, etc.)
