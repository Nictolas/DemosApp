# 🗑️ ISTRUZIONI ELIMINAZIONE TABELLE LOG DA NEON

## ⚠️ ATTENZIONE

**Esegui questa procedura SOLO DOPO aver verificato che tutto funzioni correttamente in produzione!**

---

## ✅ Checklist Pre-Eliminazione

Prima di eliminare le tabelle, verifica:

- [ ] ✅ **Deploy completato** su Render
- [ ] ✅ **AXIOM_ENABLED=true** su Render (verifica nelle variabili ambiente)
- [ ] ✅ **Dataset Axiom contengono dati**:
  - `centralized_logs` → Contiene log applicativi
  - `real-time` → Contiene audit logs e security events
- [ ] ✅ **Test funzionalità in produzione**:
  - Dashboard admin audit: `/api/admin/audit-dashboard/stats`
  - Dashboard logging: `/api/admin/logging/stats`
  - Export GDPR: `/api/user/gdpr-rights/export`
  - Violation detection: `/api/admin/security-metrics/real-violations`
- [ ] ✅ **Backup database** (opzionale ma consigliato)

---

## 📋 Procedura Eliminazione

### Opzione 1: Usando lo script SQL (Consigliato)

1. **Connettiti a Neon** (via Dashboard o psql)

2. **Esegui lo script**:
   ```bash
   psql $DATABASE_URL -f scripts/elimina-tabelle-log-neon.sql
   ```
   
   Oppure copia e incolla il contenuto di `scripts/elimina-tabelle-log-neon.sql` nell'editor SQL di Neon.

3. **Verifica l'eliminazione**:
   Lo script mostrerà un messaggio di conferma se tutto è andato a buon fine.

### Opzione 2: Eliminazione manuale

Esegui questi comandi SQL uno alla volta:

```sql
-- Elimina viste
DROP VIEW IF EXISTS centralized_logs_decompressed CASCADE;
DROP VIEW IF EXISTS audit_logs_decompressed CASCADE;

-- Elimina tabelle compresse
DROP TABLE IF EXISTS centralized_logs_compressed CASCADE;
DROP TABLE IF EXISTS audit_logs_compressed CASCADE;

-- Elimina tabelle principali
DROP TABLE IF EXISTS centralized_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
```

---

## 🔍 Verifica Post-Eliminazione

Dopo l'eliminazione, verifica che:

1. **Le tabelle non esistono più**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name IN (
       'centralized_logs', 
       'audit_logs', 
       'centralized_logs_compressed', 
       'audit_logs_compressed',
       'centralized_logs_decompressed',
       'audit_logs_decompressed'
   );
   ```
   Dovrebbe restituire 0 righe.

2. **L'applicazione funziona ancora**:
   - Testa le dashboard admin
   - Testa l'export GDPR
   - Verifica che i log vengano ancora creati (su Axiom)

3. **Axiom riceve i log**:
   - Verifica su Axiom Dashboard che i nuovi log arrivino
   - Controlla che i dataset contengano i dati

---

## 🚨 Cosa Fare in Caso di Problemi

Se dopo l'eliminazione riscontri problemi:

1. **Verifica AXIOM_ENABLED**:
   ```bash
   # Su Render, verifica che AXIOM_ENABLED=true
   ```

2. **Verifica connessione Axiom**:
   - Controlla `AXIOM_API_TOKEN` e `AXIOM_ORG_ID`
   - Verifica che i dataset esistano su Axiom

3. **Ripristina le tabelle** (se necessario):
   - Se hai fatto backup, ripristina le tabelle
   - Altrimenti, ricreale usando gli script di migrazione

4. **Controlla i log dell'applicazione**:
   - Verifica che non ci siano errori di connessione ad Axiom
   - Controlla che i log vengano inviati correttamente

---

## 📝 Note Importanti

1. **Fallback**: Le query SQL su Neon sono mantenute come fallback quando `AXIOM_ENABLED !== 'true'`. Dopo l'eliminazione delle tabelle, se disabiliti Axiom, l'applicazione non funzionerà correttamente.

2. **GDPR Compliance**: I log su Axiom sono GDPR-compliant e vengono conservati secondo le policy di retention configurate su Axiom.

3. **Performance**: Dopo l'eliminazione, Neon sarà più leggero e le performance miglioreranno.

4. **Backup**: Se hai bisogno di recuperare dati storici, sono disponibili su Axiom (se migrati) o nei backup del database.

---

## ✅ Conclusione

Dopo aver completato questa procedura:

- ✅ Le tabelle log sono state eliminate da Neon
- ✅ Tutti i log vengono gestiti da Axiom
- ✅ L'applicazione è più leggera e performante
- ✅ I log sono GDPR-compliant su Axiom

**Congratulazioni! La migrazione è completa! 🎉**

