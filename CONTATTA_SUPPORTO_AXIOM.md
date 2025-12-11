# 📞 Contatta Supporto Axiom

## ❌ Problema

Anche con:
- ✅ Token corretto: `xaat-d97a9535-fdc4-47ab-8197-c5847b12122d`
- ✅ Permessi corretti: Ingest (CREATE, READ), Query (READ)
- ✅ Org ID corretto: `demos-institute-jrim`
- ✅ Dataset esistente: `centralized_logs`
- ✅ Regione corretta: EU

**Tutte le richieste API restituiscono 403 Forbidden.**

## 📋 Informazioni da Fornire al Supporto

1. **Organization ID**: `demos-institute-jrim`
2. **Token**: `xaat-d97a9535-fdc4-47ab-8197-c5847b12122d` (nome: "demosapp-backup")
3. **Endpoint testato**: `https://api.eu.axiom.co/v1/datasets/centralized_logs/ingest`
4. **Headers usati**:
   - `Authorization: Bearer xaat-d97a9535-fdc4-47ab-8197-c5847b12122d`
   - `Content-Type: application/json`
   - `X-Axiom-Org-Id: demos-institute-jrim`
5. **Errore**: `403 - forbidden`
6. **Permessi token**: Ingest (CREATE, READ), Query (READ) per "All datasets"

## 🔗 Link Utili

- **Supporto Axiom**: https://axiom.co/support
- **Documentazione API**: https://axiom.co/docs/reference/api
- **Documentazione Token**: https://axiom.co/docs/reference/tokens

## 💡 Possibili Cause da Chiedere

1. Il token ha i permessi ma non funziona - è un bug?
2. I permessi "All datasets" funzionano correttamente?
3. C'è un problema con la regione EU?
4. Il token è stato appena creato e ci vuole tempo per propagarsi?





