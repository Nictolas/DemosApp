# DEMOS — Profilo pubblico: client, minimizzazione e readiness (25 ottobre 2026)

**Stato:** modifica solo su PR in bozza, basata sulla #285. Nessun merge, deploy o dato reale.

## Problema concreto individuato

L'API pubblica `GET /api/users/:userId/public-profile` è stata introdotta per presentare la proiezione minima dei politici/candidati, con `public.governoIdeale` filtrato dal consenso politico nella PR #285. Tuttavia, il frontend `useProfileData` per profili diversi dall'account corrente chiamava ancora `GET /api/users/:userId`, che il router utenti di DEMOS protegge con `requireAdmin`. Ciò rendeva il percorso per il profilo altrui inutilizzabile da parte di utenti ordinari.

Nella stessa schermata le richieste per il proprio `GET /api/governo/ideale`, `GET /api/rappresentanti` e `GET /api/candidati/selezioni` venivano eseguite anche quando si visitava il profilo di un'altra persona: si rischiava di mostrare sul profilo altrui **le preferenze del visitatore**. L'hook e i componenti stampavano inoltre in console i payload profilo, le selezioni e gli identificativi politici. I pulsanti per scegliere rappresentanti/candidati erano visibili anche in modalità di sola lettura.

Un test smoke già presente nel ramo `main` verificava il percorso pubblico, ma era **obsoleto rispetto al frontend corrente** ed era stato escluso dalla CI privacy nella PR #285: questo scostamento è stato ora affrontato.

## Correzione proposta

- Il caricamento seleziona `GET /api/users/me` per il proprietario, oppure `GET /api/users/:targetUserId/public-profile` per gli altri. **Non è introdotto alcun percorso pubblico verso gli endpoint Admin**.
- Per profili altrui `governoIdeale`, `rappresentantiDetails` e `candidatiDetails` derivano **soltanto** da `response.data.public` del soggetto. Non viene interrogata l'API del Governo o delle selezioni del visitatore.
- Le opinioni del target vengono caricate unicamente dal GET autenticato `/api/users/:targetUserId/opinioni`, già controllato per ruolo e consenso nella catena precedentemente testata. I valori `f/c/i` vengono convertiti nelle etichette esistenti della UI; i campi null/revocati non vengono mostrati.
- AbortController e un numero progressivo di richiesta impediscono che un fetch vecchio popoli la UI dopo cambio account, navigazione o retry; prima di un nuovo caricamento sono svuotati stati e preferenze precedenti.
- Rimossi console log di profili, scelte, risultati e ID dal relativo hook e dalle due schede di selezione.
- Nascosti pulsanti “Scegli” durante la visualizzazione di altri utenti. La scheda informativa non mostra i blocchi privati di nascita, genere, residenza, professione/contatti di altri utenti. Gli stessi dati, peraltro, **non** devono essere presenti nel payload pubblico server.
- Il precedente smoke test pubblico è adeguato ai contratti effettivi e reintrodotto nella CI, affiancato da cinque test di regressione client sulla separazione proprietario/target, pulizia delle richieste, log e controlli di modifica. Nessun test usa dati personali reali.

## Verifiche e criteri per merge

La CI privacy comprende i nuovi test, il backend sintetico di lettura dei voti pubblici e la build web, ma deve completarsi con successo sul commit finale.

**Stato generale della catena, verificato in GitHub prima di questa modifica:** PR #264–#285 erano 22 bozze non integrate. Il ramo #285 era **92 commit avanti a main**, senza commit mancanti, con 85 file e 8.633 righe modificate; CI privacy e Snyk verdi. Nessun rilascio autorizzato.

**Blocchi che questa PR non può risolvere autonomamente:**

1. Revisione integrata della catena di PR e prove su staging e dispositivo Android sintetico: logout, cambio account, revoca del consenso, cache delle risposte e CDN/Cloudflare; da eseguire prima di pubblicare.
2. La DPIA in repository è intitolata **versione 1.1** (ultima revisione indicata marzo 2026): la sezione 7 parere DPO e la sezione 9 di approvazione non contengono l'esito compilato/firme; l'Allegato H del 25/10/2026 resta espressamente **BOZZA TECNICA, NON APPROVATA**. La dichiarazione in chat dell'interlocutore che si identifica come DPO non aggiorna automaticamente il documento; occorre associare la decisione alla versione, ai rischi residui e al registro formale.
3. Le selezioni di rappresentanti/candidati salvate in `user_representatives` e nei percorsi di selezione politica sono **distinte** da `CONSENT_SCOPED_TABLES` ed esposte dal profilo pubblico. Occorre determinare con il DPO se siano scelte dell'utente dipendenti dal consenso Art. 9 oppure contenuti pubblicati su una diversa e documentata base giuridica; non cancellarle o cambiarne visibilità senza tale decisione.
4. Gli aggregati con pochi votanti e le differenze temporali/territoriali possono consentire inferenze politiche. Verificare soglie, accessi e contromisure a seconda dell'uso.
5. La CI privacy è una **suite focalizzata**, non una prova di tutti i test del repository: eseguire anche le altre verifiche pertinenti e controllare conflitti nell'integrazione di tutte le PR concatenate.

**Nessun merge, deploy, cambio di dati reali o accesso alla produzione.**
