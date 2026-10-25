# DEMOS — Notifiche ai sostenitori e revoca del consenso politico

**Data:** 25 ottobre 2026. **Stato:** correzione proposta in bozza, concatenata alla PR #286. Nessun merge né deploy.

## Problema verificato

Il servizio condiviso loadSupporterUserIds leggeva i sostenitori da political_selections, o dalle colonne legacy users.rappresentante_*/candidato_*, senza verificare che il consenso al trattamento delle opinioni politiche di ciascun sostenitore fosse ancora attivo. Se rimanevano selezioni residue dopo revoca, la persona continuava a figurare tra i destinatari di push e notifiche relative alle opinioni dei politici/candidati. La precedente protezione del profilo pubblico non risolveva questo percorso interno.

Esisteva anche una finestra tra la lettura dell'elenco dei sostenitori e quella dei token Firebase o l'inserimento di notifiche nella tabella political_opinion_notifications: la revoca poteva completarsi durante tale intervallo.

## Correzione proposta

1. Le query canonica e legacy di loadSupporterUserIds collegano users e user_consents e selezionano soltanto utenti attivi con consenso politico effettivo. La verifica viene effettuata nella stessa istruzione SELECT che ricava gli ID.
2. Entrambe le query dei token push in loadCurrentSupporterTokens ripetono il filtro del consenso, compreso il fallback senza user_devices. Un identificativo individuato prima della revoca non autorizza a ottenere nuovi token dopo la revoca.
3. La INSERT ... SELECT in createSupporterOpinionNotifications ripete il filtro del consenso del destinatario prima di registrare la notifica.
4. Non vengono eliminate selezioni, token o vecchie notifiche: questa PR corregge soltanto l'utilizzo futuro degli ID revocati per questi due servizi.

## Prove

Test unitari delle query prodotte dal codice: SELECT canonica, SELECT legacy dopo errore 42P01, lookup token normale e fallback, INSERT di notifica e assenza di lavoro su input vuoto.

Prova PostgreSQL 17 esclusivamente su localhost CI con database temporaneo e utenti sintetici: consenso attivo, consenso revocato con selezione residua, consenso senza override legacy, revoca fra lettura dei sostenitori e prelievo dei token, revoca fra lookup e INSERT della notifica, schema privo della tabella canonica. Tutte le tabelle sono TEMP e il test termina con ROLLBACK. Le guardie di ambiente impediscono l'impiego di credenziali Supabase/Render e di dati di produzione.

## Rischi e vincoli residui

Non sono coperte automaticamente altre letture o scritture di political_selections, users.rappresentante_*, users.candidato_* o user_representatives. Il filtro non ritira notifiche già inviate né annulla push consegnati in precedenza a Firebase. La base giuridica, il consenso alla pubblicazione, la durata della conservazione e l'erasure delle selezioni politiche persistenti devono ancora essere stabiliti e verificati insieme al titolare e al DPO competente. Resta il rischio di inferenza da aggregati politici troppo piccoli.

Prima del merge servono revisione cumulativa delle PR #264–#287, verifiche di staging, Android, CDN, logout/cambio account, pianificazione di rollback e aggiornamento formale della DPIA con versione e parere verificabile. La dichiarazione del DPO in chat non equivale alla compilazione delle sezioni formali del documento né prova l'identità del firmatario. Nessuna modifica alla produzione o accesso a dati personali reali.
