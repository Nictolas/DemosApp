# 📋 Istruzioni per la Deduplicazione Axiom

## ✅ MODIFICHE COMPLETATE

Le modifiche al codice sono state completate. Ora devi:

---

## 🚀 STEP 1: Deploy del Backend

### Opzione A: Deploy Automatico (se hai CI/CD)
- Se hai GitHub Actions o altro sistema CI/CD, fai un commit e push
- Il deploy avverrà automaticamente

### Opzione B: Deploy Manuale su Render
1. Vai su Render Dashboard: https://dashboard.render.com
2. Trova il servizio `demos-backend`
3. Clicca su "Manual Deploy" → "Deploy latest commit"
4. Attendi che il deploy completi (2-5 minuti)

### Opzione C: Deploy Locale (solo per test)
```bash
# Se vuoi testare localmente prima
npm run dev
```

---

## ⏱️ STEP 2: Attendi il Deploy

- **Tempo stimato**: 2-5 minuti
- **Verifica**: Controlla i log su Render per vedere se il deploy è completato
- **Test**: Vai su `https://www.demos.community/admin/data-export/axiom` e verifica che la pagina carichi

---

## 🧹 STEP 3: Esegui la Deduplicazione

### Metodo 1: Interfaccia Web (CONSIGLIATO)

1. **Vai sulla pagina Axiom**:
   - URL: `https://www.demos.community/admin/data-export/axiom`
   - Oppure: Vai su `/admin/data-export` e clicca su "Dati su Axiom"

2. **Seleziona il Dataset**:
   - Clicca sul pulsante "Centralized Logs"
   - Verifica che sia selezionato (dovrebbe mostrare "Attivo")

3. **Individua i Duplicati**:
   - Clicca sul pulsante "Individua Doppioni"
   - Attendi l'analisi (può richiedere 1-2 minuti)
   - Vedrai un dialog con:
     - Record totali: ~1.085.743
     - Record unici: ~51.632
     - Duplicati: ~1.034.111

4. **Rimuovi i Duplicati**:
   - Nel dialog, clicca su "Rimuovi Duplicati"
   - ⚠️ **ATTENZIONE**: Questa operazione è IRREVERSIBILE
   - Attendi il completamento (30-60 minuti)

5. **Monitora il Progresso**:
   - Controlla i log su Render per vedere i progressi
   - Vedrai messaggi come:
     - `📊 Step 1: Query record unici...`
     - `✅ Trovati X record unici CON request_id`
     - `✅ Trovati Y record unici SENZA request_id`
     - `📤 Step 3: Invio record unici...`
     - `✅ Batch 1: 1000 record inviati...`

### Metodo 2: Script Automatizzato (Alternativo)

Se preferisci usare lo script:

1. **Ottieni il Token di Autenticazione**:
   - Apri il browser su `https://www.demos.community`
   - Apri la console (F12)
   - Esegui: `localStorage.getItem('auth_token')`
   - Copia il token

2. **Aggiungi al file `.env`**:
   ```
   AXIOM_DEDUP_TOKEN=il_tuo_token_qui
   ```

3. **Esegui lo Script**:
   ```bash
   node scripts/deduplicate-axiom-automated.js
   ```

---

## ⏱️ TEMPO STIMATO

- **Query record unici**: 10-20 minuti (con 1 milione di record)
- **Invio batch temporaneo**: 15-30 minuti (~52 batch)
- **Eliminazione originale**: 1-2 minuti
- **Copia finale**: 15-30 minuti (~52 batch)
- **TOTALE**: **45-90 minuti**

---

## 📊 COSA SUCCEDE DURANTE LA DEDUPLICAZIONE

### Step 1: Query Record Unici
- Esegue 2 query separate:
  - Record CON request_id: `summarize arg_max(_time, *) by _time, message, request_id`
  - Record SENZA request_id: `summarize arg_max(_time, *) by _time, message, user_id, ip_address`
- Filtra lato server per separare i due gruppi
- Unisce i risultati

### Step 2: Creazione Dataset Temporaneo
- Crea `centralized_logs_deduped_[timestamp]`
- Questo dataset è temporaneo

### Step 3: Invio Record Unici
- Invia i record in batch di 1000
- ~52 batch totali
- Ogni batch richiede ~30-60 secondi

### Step 4: Eliminazione Dataset Originale
- ⚠️ **QUESTO È IL PUNTO CRITICO**
- Elimina `centralized_logs` originale
- Se questo step fallisce, il dataset originale rimane intatto

### Step 5: Creazione Dataset Finale
- Crea nuovo `centralized_logs`
- Copia i dati dal temporaneo
- Elimina il temporaneo

---

## ⚠️ RISCHI E MITIGAZIONI

### Se qualcosa va male:

1. **Errore durante Step 1-3**:
   - Dataset originale intatto
   - Dataset temporaneo incompleto (puoi eliminarlo)
   - **Azione**: Riprova

2. **Errore durante Step 4**:
   - Hai DUE dataset:
     - `centralized_logs` (originale con duplicati)
     - `centralized_logs_deduped_[timestamp]` (deduplicato)
   - **Azione**: Elimina manualmente `centralized_logs` e rinomina il temporaneo

3. **Errore durante Step 5**:
   - Dataset originale eliminato
   - Dataset temporaneo presente con dati deduplicati
   - **Azione**: Il codice mantiene il temporaneo, puoi usarlo

---

## ✅ VERIFICA FINALE

Dopo la deduplicazione:

1. **Controlla il conteggio**:
   - Vai su `/admin/data-export`
   - Dovresti vedere ~51.632 record su Axiom (invece di 1.085.743)

2. **Verifica i dati**:
   - Vai su `/admin/data-export/axiom`
   - Seleziona `centralized_logs`
   - Clicca "Individua Doppioni"
   - Dovresti vedere 0 duplicati

3. **Controlla i log**:
   - Verifica i log su Render
   - Dovresti vedere messaggi di successo

---

## 🎯 RIEPILOGO PASSAGGI

1. ✅ **Deploy backend** (se non hai CI/CD automatico)
2. ⏱️ **Attendi 2-5 minuti** per il deploy
3. 🌐 **Vai su** `/admin/data-export/axiom`
4. 📊 **Seleziona** dataset `centralized_logs`
5. 🔍 **Clicca** "Individua Doppioni"
6. ⚠️ **Verifica** i numeri (dovrebbero essere ~1.034.111 duplicati)
7. 🗑️ **Clicca** "Rimuovi Duplicati"
8. ⏱️ **Attendi 45-90 minuti**
9. ✅ **Verifica** il risultato

---

## 💡 NOTE IMPORTANTI

- **Non interrompere** il processo durante l'esecuzione
- **Monitora i log** su Render per vedere i progressi
- **Non chiudere** la pagina del browser (anche se puoi, il processo continua sul server)
- **Tempo totale**: 45-90 minuti (non bloccare il browser)

---

## 🆘 SE QUALCOSA VA MALE

1. **Controlla i log su Render** per vedere l'errore
2. **Verifica** se il dataset temporaneo esiste ancora
3. **Se necessario**, contattami con i log dell'errore

