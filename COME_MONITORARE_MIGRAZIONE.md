# 📊 Come Monitorare la Migrazione Axiom

## Metodo 1: Log su Render (Tempo Reale) ⭐ CONSIGLIATO

1. **Vai sui log di Render:**
   - https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg/logs

2. **Cosa cercare nei log:**
   - ✅ `✅ Batch X: Y record` - Indica che un batch è stato inviato
   - ✅ `✅ Migrazione centralized_logs completata: X record in Y batch`
   - ✅ `✅ Migrazione audit_logs completata: X record in Y batch`
   - ✅ `🎉 Migrazione completata!` - Migrazione terminata con successo
   - ❌ `❌ Errore durante la migrazione` - Se ci sono errori

3. **Esempio di log atteso:**
   ```
   🚀 Avvio migrazione dati da Neon a Axiom...
   📊 Migrazione centralized_logs da Neon a Axiom...
   📈 Record totali da migrare: 51.642
   ✅ Batch 1: 1000 record (totale: 1.000/51.642)
   ✅ Batch 2: 1000 record (totale: 2.000/51.642)
   ...
   ✅ Migrazione centralized_logs completata: 51.642 record in 52 batch
   ```

## Metodo 2: Verifica su Axiom (Dopo il Completamento)

1. **Vai su Axiom Dashboard:**
   - Dataset centralized_logs: https://app.axiom.co/demos-institute-jrim/datasets/centralized_logs
   - Dataset real-time: https://app.axiom.co/demos-institute-jrim/datasets/real-time

2. **Cosa verificare:**
   - **Events**: Dovrebbe mostrare il numero di record migrati
   - **Data**: Dovrebbe mostrare la dimensione dei dati
   - **Fields**: Dovrebbe mostrare i campi disponibili

3. **Query di test su Axiom:**
   ```apl
   centralized_logs
   | count
   ```
   Dovrebbe restituire ~51.642 record

   ```apl
   real-time
   | where log_type == "audit"
   | count
   ```
   Dovrebbe restituire ~3.220 record

## Metodo 3: Script di Verifica Locale

Esegui lo script per vedere lo stato:
```bash
node scripts/check-migration-status.js
```

Questo mostra:
- Quanti record ci sono ancora da migrare in Neon
- Link per verificare su Axiom
- Link per i log su Render

## Tempo Stimato

- **Record totali**: ~55.000
- **Batch size**: 1.000 record
- **Pausa tra batch**: 1 secondo
- **Tempo stimato**: 10-15 minuti

## Cosa Fare Se la Migrazione Si Blocca

1. **Controlla i log su Render** per vedere l'errore
2. **Verifica che il token Axiom sia ancora valido**
3. **Riprova la migrazione** se necessario:
   ```bash
   node scripts/start-migration-with-login.js --confirm
   ```

## Verifica Finale

Dopo il completamento, verifica che:
- ✅ centralized_logs abbia ~51.642 eventi su Axiom
- ✅ real-time abbia ~3.220 eventi con `log_type: "audit"`
- ✅ I dati siano accessibili tramite query su Axiom

