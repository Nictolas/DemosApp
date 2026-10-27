# DEMOS — Consenso politico e accesso alle funzioni personalizzate (26 ottobre 2026)

**Stato:** proposta DRAFT sulla catena #264–#291, senza merge, deploy o operazioni su dati reali.

## Decisione funzionale

DEMOS tratta dati sulle opinioni politiche (art. 9 GDPR). La revoca del consenso esplicito deve disattivare le funzioni che richiedono quelle risposte personali, non l'intero account.

**Consenso attivo:** l'utente può salvare opinioni, partecipare alle votazioni politiche per le quali è idoneo, scegliere i candidati/rappresentanti secondo le regole dell'app, effettuare confronti personalizzati e contribuire ai conteggi aggregati con consenso attivo. Le relative verifiche di consenso e la serializzazione delle scritture sono distribuite nelle PR precedenti.

**Consenso assente o revocato:** le scritture delle preferenze politiche continuano a essere bloccate; i tre GET di matching /api/candidati/europei, /api/candidati/disponibili e /api/rappresentanti/disponibili rispondono 403 e codice POLITICAL_CONSENT_REQUIRED, senza suggerimenti personali. L'interessato conserva accesso a consultazione di contenuti e informazioni pubbliche, impostazioni GDPR, download dati, cancellazione account e concessione volontaria di nuovo consenso. L'assenza del consenso non è una ragione automatica per eliminare l'account o impedire di leggere documenti istituzionali pubblici.

L'Art. 7(4) GDPR e le linee guida EDPB 05/2020 sulla condizionalità sconsigliano di subordinare servizi indipendenti al consenso per trattamenti non necessari. L'Art. 9(2)(a) richiede consenso esplicito per trattare le opinioni politiche quando questa è la condizione invocata. La regola progettuale va sottoposta alla verifica del titolare/DPO, con finalità e conseguenze comprensibili nell'informativa.

## Implementazione

- Servizio comune politicalPersonalizationAccessService per verificare il consenso effettivo su users + user_consents, con risposta 401/403/404/500 fail-closed e senza logging dei dati politici.
- Ciascuno dei tre endpoint di matching effettua una verifica **prima** del recupero di opinioni e una verifica **subito prima** di restituire il ranking, per nascondere risultati calcolati durante una revoca. Il middleware delle route mantiene Cache-Control private, no-store prima di autenticazione e di errori.
- Entrambi i percorsi di registrazione con consenso politico permettono esplicitamente di proseguire senza aderire e salvano false in registrazione_political_opinions_consent; non è necessario accettare per arrivare al passaggio successivo.
- Testi coerenti nella modale di consenso e nel dialogo GDPR: le funzioni personali diventano non disponibili; le altre categorie pubbliche restano fruibili. Rimossa la promessa di eliminazione “completa” non ancora dimostrata per i dati legacy.
- La pagina di scelta candidati usa un solo endpoint parametrizzato `/api/candidati/disponibili?grado_candidatura=<E|C|S|R|CO>` per tutte le cinque categorie; l'alias `/api/candidati/europei` resta lato server per compatibilità con client Android precedenti. Il client mostra un messaggio mirato quando il server risponde con consenso richiesto.
- Test HTTP su consenso revocato per candidati e rappresentanti; test unitari di errore, consenso, auth e ordine delle verifiche; test statici del client e build web.

## Cosa rimane

Non è dimostrata l'anonimizzazione permanente di qualunque risultato aggregato. Per i dati ricavati da gruppi piccoli, territorio e sequenza temporale possono creare rischi di inferenza: applicare soglie già previste e valutare nella DPIA l'effettiva non-identificabilità.

**Proposta tecnica PR #295 (ancora DRAFT):** la revoca elimina transazionalmente le selezioni personali da `political_selections` e `user_representatives` e azzera i dieci campi legacy di scelta in `users`. La stessa cancellazione viene riapplicata dal privacy-erasure ledger dopo un ripristino che riportasse in vita dati antecedenti alla revoca. Non vengono cancellati i mandati, i voti istituzionali importati o le scelte di altri utenti che hanno selezionato il profilo revocante. Il codice è stato verificato con test PostgreSQL sintetici, **non** su utenti di produzione.

La policy sulla conservazione di eventuali scelte soggette a un'altra base giuridica, la descrizione dell'effetto della revoca nell'informativa, i tempi e le garanzie operative di restore/backup devono essere validati da titolare e DPO nella DPIA prima del rilascio. Un database ripristinato non deve diventare accessibile agli utenti prima del replay degli eventi di cancellazione. Restano necessarie prove Android/CDN, logout/cambio account e integrazione finale di tutte le PR privacy.

Nessun codice della proposta deve essere pubblicato prima della review integrata, delle verifiche di conformità e dell'autorizzazione esplicita al deploy.
