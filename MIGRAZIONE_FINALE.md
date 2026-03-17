# 🚀 Migrazione Neon → Axiom - Istruzioni Finali

## 📊 Situazione Attuale

- **Record da migrare:**
  - `centralized_logs`: 51.642 record
  - `audit_logs`: 3.204 record
  - **Totale: ~55.000 record**

## ⚠️ Problema

L'SDK Axiom in locale non rispetta correttamente la regione EU, causando errori durante la migrazione.

## ✅ Soluzione: Migrazione su Render

La migrazione deve essere eseguita su Render, dove:
- ✅ La configurazione Axiom è corretta
- ✅ La regione EU è rispettata
- ✅ Il DATABASE_URL è già configurato

## 🔧 Come Procedere

### Opzione 1: Via API Endpoint su Render (Consigliato)

1. **Accedi all'applicazione su Render come admin**
2. **Ottieni un token JWT admin** (dalla sessione del browser o generandone uno)
3. **Esegui la migrazione tramite API:**

```bash
# Verifica status
curl -X GET "https://demos-c7k0.onrender.com/api/admin/axiom-migration/status" \
  -H "Authorization: Bearer <REDACTED_TOKEN>" \
  -H "Content-Type: application/json"

# Avvia migrazione
curl -X POST "https://demos-c7k0.onrender.com/api/admin/axiom-migration/migrate" \
  -H "Authorization: Bearer <REDACTED_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tables": ["centralized_logs", "audit_logs"], "dryRun": false}'
```

### Opzione 2: Via Script Locale (se hai token admin)

```bash
node scripts/start-axiom-migration.js --confirm
```

**Nota:** Serve configurare `ADMIN_TOKEN` o `JWT_SECRET` nel `.env` con un token admin valido.

### Opzione 3: Via Render Shell (se disponibile)

Se hai accesso a Render Shell (feature a pagamento):

```bash
cd /opt/render/project/src
node scripts/migrate-neon-to-axiom.js migrate
```

## 📋 Checklist Pre-Migrazione

- [x] Variabili Axiom configurate nel `.env`
- [x] DATABASE_URL configurato
- [x] Dataset Axiom creati (`centralized_logs` e `real-time`)
- [x] API Token Axiom con permessi "Ingest" e "Query"
- [ ] Token admin JWT per autenticazione API

## 🎯 Dopo la Migrazione

1. **Verifica su Axiom:**
   - Vai su https://app.axiom.co/demos-institute-jrim/datasets/centralized_logs
   - Vai su https://app.axiom.co/demos-institute-jrim/datasets/real-time
   - Controlla che i record siano presenti

2. **Monitora i log su Render** per vedere il progresso della migrazione

3. **Dopo verifica, puoi decidere se eliminare i vecchi log da Neon** (opzionale)

## 💡 Note

- La migrazione avviene in batch di 1000 record alla volta
- C'è una pausa di 1 secondo tra ogni batch per evitare sovraccarichi
- La migrazione completa richiederà circa 10-15 minuti per ~55.000 record
- I dati in Neon restano intatti (la migrazione è in sola lettura)

