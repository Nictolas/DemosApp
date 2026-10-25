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
- Test HTTP su consenso revocato per candidati e rappresentanti; test unitari di errore, consenso, auth e ordine delle verifiche; test statici del client e build web.

## Cosa rimane

Non è dimostrata l'anonimizzazione permanente di qualunque risultato aggregato. Per i dati ricavati da gruppi piccoli, territorio e sequenza temporale possono creare rischi di inferenza: applicare soglie già previste e valutare nella DPIA l'effettiva non-identificabilità.

Le tabelle political_selections, user_representatives e i campi legacy in users non sono ancora eliminati nella revoca: resta da definire una policy documentata di retention/erasure. Sono inoltre necessarie prove Android/CDN, logout/cambio account e verifica formale della versione DPIA con approvazione DPO, insieme a test di integrazione dei PR cumulativi.

Nessun codice della proposta deve essere pubblicato prima della review integrata, delle verifiche di conformità e dell'autorizzazione esplicita al deploy.
