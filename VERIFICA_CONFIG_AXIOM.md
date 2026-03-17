# 🔍 Verifica Configurazione Axiom su Render

## ⚠️ Errore Attuale

```
Axiom API error: 403 - forbidden
```

Questo significa che:
- ✅ La funzione `sendToAxiomHTTP` funziona (non c'è più errore di regione)
- ❌ Il token Axiom su Render non ha i permessi corretti o è scaduto

## 🔧 Cosa Verificare su Render

1. **Vai su Render Dashboard** → Il tuo servizio → **Environment**

2. **Verifica queste variabili:**
   - `AXIOM_ENABLED=true`
   - `AXIOM_API_TOKEN=xaat-...` (deve essere il token aggiornato)
   - `AXIOM_ORG_ID=demos-institute-jrim`
   - `AXIOM_REGION=eu`
   - `AXIOM_DATASET=centralized_logs`
   - `AXIOM_REALTIME_DATASET=real-time`

3. **Se il token non è aggiornato:**
   - Vai su Axiom → Settings → API Tokens
   - Genera un nuovo token con permessi **Ingest** e **Query**
   - Aggiorna `AXIOM_API_TOKEN` su Render

## 🎯 Prossimi Passi

1. Verifica/aggiorna il token su Render
2. Riprova la migrazione

