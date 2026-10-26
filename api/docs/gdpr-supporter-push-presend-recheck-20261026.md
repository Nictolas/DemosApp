# DEMOS — Verifica di consenso e token immediatamente prima delle notifiche push

**26 ottobre 2026 — PR DRAFT stacked su #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302. Issue #296 aperta.**

## Rischio concreto

`loadCurrentSupporterTokens` rilegge selezioni, stato attivo, consenso e token dello schema `public` dopo le correzioni delle PR #335/#338. `sendPushToCurrentSupporters` però prendeva quell'elenco **una sola volta** e inviava ciascun token successivamente, con più richieste di rete Firebase e possibili ritardi intermedi. Una revoca o disattivazione del token completata durante il ciclo non impediva necessariamente l'invio dei token già presenti nella prima fotografia.

## Mitigazione implementata

- `isCurrentSupporterTokenEligible(pool, {userIds,token})` esegue una nuova SELECT parametrizzata, in sola lettura, **subito prima di ogni invio**. Richiede un account nello schema `public.users` con `status='a'`, consenso politico valido da `public.user_consents` (oppure legacy su `users`), e il token ancora assegnato a quello stesso account in `public.user_devices` attivo oppure in `public.users.fcm_tokens`.
- L'identità dei possibili proprietari del token deriva dai sostenitori della selezione iniziale. Non basta che un account diverso possieda lo stesso token; deve essere fra gli account che hanno autorizzato quella notifica. I token duplicati vengono inviati una sola volta come prima.
- In caso di risultato negativo, token rimosso, errore di connessione o SQL inatteso, **non viene chiamato Firebase**. Un errore della tabella dispositivi `42P01` o della colonna `42703` usa il fallback legacy, ma con account/consenso/token esclusivamente canonici; se fallisce anche il fallback, la verifica resta negativa.
- Il risultato aggiunge il contatore `skipped` per distinguere invii soppressi dalle chiamate Firebase fallite (`failed`); nessun token, ID personale o scelta politica viene aggiunto ai log.
- La verifica comporta **una query di autorizzazione per token** (due solo nel fallback legacy), senza nuove tabelle, cron, API, configurazioni o connessioni esterne. Potrà essere ottimizzata se misure di carico su staging mostrano costi elevati; ciò richiede verifica esplicita prima di intervenire sulle prestazioni.

## Regressioni senza provider reale

Il nuovo test `api/tests/currentSupporterPushPreSendConsent.test.js`, incluso nel workflow di privacy/consenso, verifica: uso esclusivo di `public`, parametri vincolati, condizioni di consenso e token ancora registrato, fallback `42P01`, fail-closed su errori del DB, soppressione del secondo token se la revoca arriva durante il primo invio e soppressione di token rimossi. La facade Firebase è sostituita da uno stub locale all'interno del file di test: **nessuna notifica viene spedita e nessuna credenziale viene letta**.

Restano inoltre le prove sintetiche PostgreSQL 17 dei precedenti interventi (#338) sul rispetto della revoca tra lookup iniziale e lettura token, nonché gli altri controlli di CI.

## Garanzie *non* ottenute

Questa correzione **riduce** la finestra tra revoca e invio, **non fornisce una barriera atomica** rispetto a una revoca che arrivi dopo il check SQL ma prima che Firebase accetti il messaggio o lo consegni. La verifica non blocca `public.users` e **non** tiene una transazione aperta durante una chiamata al provider, per non impedire la revoca dell'utente a causa di latenza remota. Token già inoltrati al provider potrebbero non essere annullabili. L'eventuale garanzia più forte richiederebbe un protocollo di dispatcher/revoca e decisioni tecniche e organizzative separate.

Non si attesta inoltre la durabilità/completezza/freschezza indipendente dell'intero registro GDPR fino al freeze, l'isolamento reale Render/Supabase/Data API/worker, le proprietà B2 Object Lock COMPLIANCE/VersionId su staging provider, o l'approvazione DPIA/titolare/DPO e retention/costi.

**Nessun merge, deploy, migrazione, accesso ai dati reali, credenziale, produzione, costo o servizio attivato.**
