# DEMOS — Selezioni politiche nel profilo personale (25 ottobre 2026)

**Stato:** proposta DRAFT concatenata alla PR #289. Nessun merge o deploy.

## Problema verificato

Le API autenticazione/profilo GET /api/auth/me e GET /api/users/me restituivano le dieci selezioni politiche legacy di candidati e rappresentanti anche dopo la revoca del consenso Art. 9. Il dato poteva provenire da user_representatives o dalle colonne users, incluso il fallback SELECT * per schemi vecchi. Le PR #285–#289 proteggono già altre proiezioni e le scritture concorrenti, ma non questo payload molto usato dal client. Esistevano anche log email e dettagli SQL/stack non necessari.

## Correzioni proposte

- Nuovo servizio condiviso personalPoliticalSelectionVisibilityService con allowlist generata dal registro degli uffici italiani: tutte le cinque selezioni di candidati e cinque di rappresentanti. Con consenso politico assente o revocato le sole dieci preferenze sono null, conservando la struttura JSON del client. Ruolo, identità, dati ufficiali e capacità dell'account rimangono invariati.
- Entrambi i GET interrogano getPoliticalConsentState sul DB **appena prima di serializzare** la risposta; eccezioni o errori nella verifica producono errore 500 senza preferenze. Si applica anche al fallback SELECT * da users, con override user_consents prevalente sul vecchio flag users.
- Rimosso il logging di indirizzi email o dettagli dell'eccezione SQL dalle due letture. Entrambe mantengono Cache-Control: private, no-store, max-age=0, anche per autenticazione fallita.
- Nessuna cancellazione o modifica dei dati memorizzati: la policy GDPR per canonical political_selections, user_representatives e colonne legacy non è ancora deliberata; nessuna modifica alla fonte istituzionale dei mandati.

## Test

15 test unitari sul servizio e sui veri handler estratti dal sorgente: consenso attivo e revocato, admin, fallback dello schema, record assente, errore DB fail-closed, 401 e no-store. Prova PostgreSQL 17 su database temporaneo locale CI con tabelle TEMP users/user_consents/user_representatives e soli valori sintetici: scelta attiva, scelta revocata residua, precedenza di user_consents, assenza della riga di override, revoca con dato ancora persistito. ROLLBACK finale.

## Limiti e gate

La mitigazione riguarda le **risposte** e non realizza da sola la cancellazione dei dati né il controllo legale della conservazione. Un dato pre-revoca rimasto nel DB può riemergere dopo un eventuale nuovo consenso senza una policy di eliminazione, da definire con il titolare e formalizzare nella DPIA. Il controllo della risposta non può invalidare dati già ricevuti su device, cache o log storici, né risposte inviate prima della revoca. La query di consenso aggiunge una lettura SQL per profilo: misurare il carico sul target utenti.

Servono review consolidata delle PR #264–#290, prove web/Android/CDN con account sintetici, verifica dello storage locale e della gestione della revoca, DPIA versione e parere DPO associati formalmente, piano di rollback e autorizzazione separata prima di merge/deploy.

**Nessun accesso a produzione o dati personali reali.**
