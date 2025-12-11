# 🔍 Debug Errore 403 Axiom

## ⚠️ Problema

Errore `403 - forbidden` quando si tenta di inviare dati ad Axiom.

## ✅ Cosa Ho Fatto

1. Aggiunto logging dettagliato in `sendToAxiomHTTP` per vedere:
   - URL chiamato
   - Dataset usato
   - Numero di eventi
   - Token (primi 10 caratteri)
   - Org ID
   - Risposta completa di Axiom

## 🔧 Cosa Verificare

Dopo il commit e deploy, i log su Render mostreranno:
- Se `AXIOM_API_TOKEN` è presente
- Se `AXIOM_ORG_ID` è presente
- L'URL esatto chiamato
- La risposta dettagliata di Axiom

## 📋 Possibili Cause

1. **Token non ha permessi "Ingest"** - Verifica su Axiom → Settings → API Tokens
2. **Token scaduto o revocato** - Rigenera il token
3. **Org ID errato** - Verifica su Axiom → Settings → Organization
4. **Dataset non esiste** - Verifica che `centralized_logs` esista su Axiom
5. **Token non ha accesso al dataset** - Verifica i permessi del token

## 🎯 Prossimi Passi

1. Fai commit e push
2. Attendi deploy su Render
3. Riprova migrazione
4. Controlla i log su Render per vedere i dettagli





