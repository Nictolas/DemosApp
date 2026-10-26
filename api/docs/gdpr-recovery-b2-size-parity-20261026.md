# DEMOS — Allineamento dimensione eventi GDPR tra manifest e B2

**26 ottobre 2026 — PR #310 DRAFT, stacked su #309 → #308 → #302.**

## Lacuna rilevata

La serializzazione canonica del journal B2 in `privacyErasureB2Journal.normalizeEvent` applica un massimo di 8192 byte per evento, ma il manifest firmato in `privacyRecoveryGateService.normalizeEvent` accettava gli stessi eventi senza questo limite. In caso di ripristino, un evento oversize contenuto in un manifest HMAC valido poteva essere importato nel ledger e accodato nell'outbox, ma il successivo worker B2 avrebbe rifiutato definitivamente la consegna. Non è un difetto della firma: l'autenticità del manifest non prova che ogni record sia archiviabile.

## Comportamento proposto

Il normalizzatore del manifest firmato calcola la lunghezza in byte del JSON canonico dello stesso evento e rifiuta una lunghezza maggiore di 8192, prima di firmare, verificare o usare il payload per la riconciliazione. Il controllo è uguale al limite già applicato dal journal B2. La verifica non esegue SQL, PUT, GET o DDL in caso di evento oversize; l'errore è esplicito.

## Prove

Test sintetico con evento da meno di 8192 byte accettato, evento da oltre 8192 rifiutato già in fase di firma e payload con firma solo apparentemente valida rifiutato dai due ingressi offline (`reconcileRestoredPrivacyState` e `verifyOutboxRecoveryReadiness`) prima di SQL o B2. I workflow GitHub Actions vanno verificati separatamente; nessuna prova usa dati reali.

## Limiti / dipendenze (#296)

Questo controllo impedisce una classe di recovery bloccati, ma non garantisce che il registro esterno sia completo, fresco e indipendente. Restano la perdita di eventi prima dell'export, il checkpoint anti-rollback, la verifica su B2 staging reale autorizzato, la quarantena completa di Render/Supabase e le decisioni di DPIA, conservazione e costi. **Nessun merge, deploy, migrazione, segreto, servizio attivato o accesso alla produzione.**
