# DEMOS — catalogo ufficiale delle opinioni (codice)

Snapshot in sola lettura dalla tabella `public.opinioni_domande` Supabase DEMOS del **28 ottobre 2026**: 94 voci con `id`, `text`, `gradi_opinione`, `approfondimento`. Le sei parti `opinions-part-00.json` — `opinions-part-05.json` sono combinate da `api/services/opinionCatalog.js` come catalogo immutabile. Nessuna risposta utente è inclusa.

- **ID stabili:** le risposte personali sono tuttora nelle colonne con questi ID in `opinioni_risposte`; non rinominare o riciclare ID senza piano di migrazione e conservazione storica.
- **Pubblicazione:** modifica tramite PR con test ed esplicita release backend. Le vecchie app Android continuano a utilizzare l'API; quindi un nuovo AAB non è obbligatorio solo per modificare le domande.
- **Proposte:** `opinioni_proposte` rimane database dinamico per proposte e voti. Nessuna proposta entra automaticamente nel catalogo ufficiale o viene approvata dall'app. Il rilascio ufficiale avviene via PR.
- **Parità:** prima della promozione in produzione verificare esattamente i 94 ID/testi/ambiti/approfondimenti col comando read-only `node api/scripts/checkOpinionCatalogParity.js` con credenziali DB di sola lettura e con rollback pronto.
- **Rollback:** la tabella `opinioni_domande` non viene cancellata né modificata. Prima del cutover serve la verifica di tutte le route, i contratti legacy Android e le dipendenze SQL; database delle risposte e consensi rimangono autorevoli.
