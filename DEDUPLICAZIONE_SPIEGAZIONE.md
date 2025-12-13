# 📋 Spiegazione Completa: Processo di Deduplicazione Axiom

## ⚠️ ATTENZIONE: OPERAZIONE IRREVERSIBILE

Questa operazione **ELIMINA** il dataset originale e lo sostituisce con una versione deduplicata. 
**NON PUOI ANNULLARE** questa operazione una volta iniziata.

---

## 🔍 COSA FA LA DEDUPLICAZIONE?

### Problema Attuale:
- **Record su Neon**: 51.642
- **Record su Axiom**: 1.085.743
- **Duplicati**: ~1.034.000 (circa 20x)

### Obiettivo:
Ridurre i record su Axiom da 1.085.743 a ~51.642 (rimuovendo i duplicati).

---

## 📊 PASSAGGI DETTAGLIATI

### **STEP 0: Conteggio Record Originali**
- Conta quanti record ci sono nel dataset `centralized_logs` PRIMA della deduplicazione
- **Risultato atteso**: ~1.085.743 record

### **STEP 1: Query Record Unici**
- **Query APL**: `['centralized_logs'] | summarize arg_max(_time, *) by _time, message`
- **Cosa fa**: 
  - Raggruppa tutti i record per `_time` + `message`
  - Per ogni gruppo, prende solo il record con `_time` più recente (`arg_max`)
  - Restituisce solo i record unici
- **Risultato atteso**: ~51.642 record unici
- **Tempo stimato**: 5-15 minuti (con 1 milione di record)

### **STEP 2: Creazione Dataset Temporaneo**
- Crea un nuovo dataset chiamato `centralized_logs_deduped_[timestamp]`
- **Esempio**: `centralized_logs_deduped_1734115200000`
- Questo dataset è **temporaneo** e verrà eliminato alla fine

### **STEP 3: Invio Record Unici al Dataset Temporaneo**
- Prende i ~51.642 record unici
- Li invia al dataset temporaneo in batch di 1000 record
- **Numero di batch**: ~52 batch
- **Tempo stimato**: 10-20 minuti

### **STEP 4: Eliminazione Dataset Originale**
- ⚠️ **QUESTO È IL PUNTO CRITICO**
- Elimina il dataset originale `centralized_logs`
- **Se questo step fallisce**, il dataset originale rimane intatto
- **Se questo step riesce**, il dataset originale è **PERDUTO PER SEMPRE**

### **STEP 5: Creazione Dataset Finale**
- Crea un nuovo dataset chiamato `centralized_logs` (stesso nome dell'originale)
- **Problema**: Axiom non supporta il "rename", quindi:
  1. Crea nuovo dataset `centralized_logs`
  2. **Rilegge TUTTI i record** dal dataset temporaneo
  3. **Re-invia TUTTI i record** al nuovo dataset `centralized_logs`
  4. Elimina il dataset temporaneo

### **STEP 6: Verifica**
- Conta i record nel nuovo dataset
- Dovrebbe essere ~51.642 record

---

## ⚠️ RISCHI E PROBLEMI POTENZIALI

### 1. **Query `arg_max` potrebbe non funzionare correttamente**
- Se la query fallisce o restituisce dati incompleti, potresti perdere record
- **Mitigazione**: Il codice verifica che ci siano record prima di procedere

### 2. **Timeout durante la query**
- Con 1 milione di record, la query potrebbe richiedere più di 5 minuti
- **Mitigazione**: Il timeout è impostato a 10 minuti

### 3. **Errore durante l'invio dei batch**
- Se un batch fallisce, potresti perdere parte dei dati
- **Mitigazione**: Il codice gestisce gli errori e continua

### 4. **Errore durante l'eliminazione del dataset originale**
- Se l'eliminazione fallisce, avrai DUE dataset:
  - `centralized_logs` (originale con duplicati)
  - `centralized_logs_deduped_[timestamp]` (deduplicato)
- **Mitigazione**: Puoi eliminare manualmente quello originale

### 5. **Errore durante la copia finale**
- Se la copia fallisce, avrai:
  - Dataset temporaneo con dati deduplicati
  - Dataset originale eliminato (se step 4 è riuscito)
  - **RISULTATO**: Perdi i dati!
- **Mitigazione**: Il codice gestisce questo caso e mantiene il dataset temporaneo

### 6. **Costi Axiom**
- La deduplicazione richiede:
  - Query su 1 milione di record
  - Inserimento di ~51.642 record (due volte: temporaneo + finale)
  - **Costi stimati**: Minimi, ma potrebbero aumentare con query complesse

---

## ✅ COSA SUCCEDE SE TUTTO VA BENE

1. Dataset originale `centralized_logs` viene eliminato
2. Nuovo dataset `centralized_logs` viene creato con ~51.642 record unici
3. Dataset temporaneo viene eliminato
4. **Risultato**: Dataset pulito senza duplicati

---

## ❌ COSA SUCCEDE SE QUALCOSA VA MALE

### Scenario 1: Errore durante STEP 1 (Query)
- **Risultato**: Nessun danno, dataset originale intatto
- **Azione**: Riprova

### Scenario 2: Errore durante STEP 3 (Invio batch)
- **Risultato**: Dataset temporaneo incompleto, dataset originale intatto
- **Azione**: Elimina dataset temporaneo e riprova

### Scenario 3: Errore durante STEP 4 (Eliminazione originale)
- **Risultato**: Hai DUE dataset:
  - `centralized_logs` (originale con duplicati)
  - `centralized_logs_deduped_[timestamp]` (deduplicato)
- **Azione**: Elimina manualmente `centralized_logs` e rinomina il temporaneo

### Scenario 4: Errore durante STEP 5 (Copia finale)
- **Risultato**: Dataset originale eliminato, dataset temporaneo presente
- **Azione**: Il codice mantiene il dataset temporaneo, puoi usarlo

---

## 🛡️ RACCOMANDAZIONI PRIMA DI PROCEDERE

### 1. **Backup (se possibile)**
- Axiom non supporta backup diretti, ma puoi:
  - Esportare un campione di record per verificare la struttura
  - Verificare che i dati su Neon siano ancora presenti

### 2. **Test su Dataset Piccolo**
- Prima di deduplicare `centralized_logs`, potresti:
  - Creare un dataset di test con pochi record
  - Testare la deduplicazione su quello
  - Verificare che funzioni correttamente

### 3. **Verifica Chiave Unica**
- La chiave unica usata è: `_time, message`
- **Problema potenziale**: Se due log diversi hanno stesso timestamp e stesso messaggio, uno verrà eliminato
- **Verifica**: Controlla se ci sono log legittimi con stesso `_time` e `message`

### 4. **Monitoraggio**
- Durante la deduplicazione, monitora:
  - I log del server (Render)
  - Il dashboard Axiom (per vedere i dataset)
  - Il tempo di esecuzione

---

## ⏱️ TEMPO STIMATO TOTALE

- **Query record unici**: 5-15 minuti
- **Invio batch temporaneo**: 10-20 minuti
- **Eliminazione originale**: 1-2 minuti
- **Copia finale**: 10-20 minuti
- **TOTALE**: **30-60 minuti**

---

## 🎯 DECISIONE

**Vuoi procedere con la deduplicazione?**

**Opzioni:**
1. ✅ **SÌ, procedi** - Esegui la deduplicazione (rischio: perdita dati se qualcosa va male)
2. ⚠️ **SÌ, ma con backup** - Prima esporta un campione, poi procedi
3. ❌ **NO, aspetta** - Analizza meglio prima di procedere

---

## 📝 NOTE TECNICHE

### Query APL Usata:
```
['centralized_logs'] | summarize arg_max(_time, *) by _time, message
```

**Spiegazione**:
- `['centralized_logs']`: Seleziona il dataset
- `summarize arg_max(_time, *)`: Per ogni gruppo, prende il record con `_time` più recente
- `by _time, message`: Raggruppa per timestamp e messaggio
- **Risultato**: Solo un record per ogni combinazione unica di `_time` + `message`

### Limitazioni:
- Se due log legittimi hanno stesso `_time` e `message`, uno verrà eliminato
- La query potrebbe non funzionare con dataset molto grandi (>10 milioni di record)
- Il processo richiede molto tempo e risorse

