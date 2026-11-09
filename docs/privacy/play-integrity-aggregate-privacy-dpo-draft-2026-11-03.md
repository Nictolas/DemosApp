# DEMOS — Valutazione privacy e telemetria Play Integrity (bozza DPO)

Data: 3 novembre 2026. Stato: **bozza tecnica NON operativa**. Non approva l'attivazione né sostituisce DPIA o informativa aggiornata.

## Finalità e base architetturale

- Limitare possibili manipolazioni dell'app Android e richieste automatizzate in operazioni selezionate; non profilare opinioni politiche o identificare persone.
- Play Integrity è soltanto un segnale di affidabilità dell'ambiente, non una prova di identità, legittimità delle firme o unicità dei voti.
- La fase iniziale, quando autorizzata, dovrà essere **solo osservazione** e non impedire accessi, revoche del consenso o funzioni web.

## Dati trattati nella predisposizione attuale

- `api/services/playIntegrityAggregate.js` conserva **esclusivamente in RAM** i contatori delle classi `verified`, `untrusted`, `unavailable` e `disabled`.
- Non conserva ID utente, IP, ID dispositivo, account Google, token, testo delle opinioni, risultati politici, hash, dettagli dei dispositivi, orario dei singoli eventi, payload, motivazioni libere o credenziali.
- Lo stato ha cardinalità fissa (quattro contatori + totale e giorno UTC); non è scritto su database, log, file, backup o piattaforme di analytics.
- L'aggregato giornaliero **non è leggibile con meno di 20 eventi** nel giorno UTC; non pubblicare o inviare aggregati privati piccoli in futuro.
- A cambio giorno UTC i contatori vengono azzerati alla prossima registrazione; al riavvio del processo si perdono. Non esiste una conservazione a lungo termine.
- La raccolta in RAM è **facoltativa**: nessuna route DEMOS importa il modulo; al momento non vi sono dati utenti o chiamate Google.

## Token e contenuti futuri (solo dopo gate €0)

- La libreria Android restituirà un token opaco. Il backend dovrà farlo decodificare da Google tramite `decodeIntegrityToken` su canale autenticato.
- La richiesta usa `requestHash` SHA-256 di parametri canonici; **mai** testo politico o dati sensibili in chiaro nel campo hash.
- Il decoder ritorna solo classificazioni consentite e non invia token o risposte complete nei log; alcuni eventi di sicurezza ad alta gravità dovranno seguire i controlli già previsti dal backend.
- Non assumere automaticamente che un device non certificato, in ROM personalizzata, offline o senza Play Services corrisponda a comportamento fraudolento.
- Prima dell'integrazione va verificato il trattamento dei body da parte di `requestLoggingMiddleware` e di eventuali proxy/strumenti di osservabilità.

## Limiti e condizioni per un rollout

1. **€0 vincolante:** nessuna attivazione Google Cloud, fatturazione o nuove risorse fino a verifica documentata e autorizzazione.
2. Nessun controllo su revoca consenso, consultazione pubblica o ad ogni apertura dell'app.
3. Feature flag e rollback server-side, mantenendo sempre autenticazione e autorizzazioni esistenti.
4. Limite **locale per singolo processo** a 50 richieste decode/giorno come precauzione offline. NON è un limite globale: prima di qualunque attivazione va implementato un limite distribuito verificabile e confrontato con i limiti Google.
5. Confermare finalità e trasparenza nell'informativa, rischio residuo, DPIA e procedure DPO prima di rendere operativa la raccolta.
6. Nessun utilizzo dello staging condiviso prima del suo sblocco; nessuna creazione di staging permanente alternativo.

## Verifiche previste

- Test offline di assenza rete con flag disattivato.
- Test per campi non consentiti nelle metriche e soglia minima di 20 eventi.
- Test per reset giornaliero, saturazione quota locale, errori 429 e assenza di retry automatici.
- Test Android e end-to-end reali solo dopo verifica costi e requisiti privacy.

Fonti: https://developer.android.com/google/play/integrity/overview
e https://developer.android.com/google/play/integrity/standard

Riferimento: PR #572 — https://github.com/Nictolas/DemosApp/pull/572