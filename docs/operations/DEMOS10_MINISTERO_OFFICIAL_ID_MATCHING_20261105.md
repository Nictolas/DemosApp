# DEMOS 10 — ID ufficiale come unica chiave per le iniziative del Ministero

05/11/2026. **Staging soltanto; non applicato in produzione.**

Il primo blocco del sincronizzatore è stato corretto dalla PR #600
(`ON CONFLICT (id)` sulla chiave primaria effettiva).
È emerso un secondo rischio: la ricerca di una riga precedente utilizzava
`id_ministero = $1 OR (TRIM(titolo) = $2 AND tipo = $3)`.
Due iniziative distinte del portale ufficiale possono avere lo stesso
titolo e la stessa tipologia; questa condizione poteva aggiornare una
riga non corrispondente, senza salvare la seconda iniziativa.

Questa patch fa coincidere **sia il SELECT iniziale sia l'upsert**
con la medesima chiave stabile derivata dall'ID ufficiale:
`ministero_${id_ministero}`.

I test di regressione richiedono che due record con lo stesso titolo,
ma ID ufficiali distinti, producano due identificativi distinti. Non
aggiungiamo indici, RLS, privilegi o nuove tabelle SQL, e non
ripristiniamo la vecchia tabella dell'elenco ministeri che è definita
nel codice frontend.

**Stato live verificato nello staging:** 12 ECI già salvate, 12
eventi `suppressed`, nessun dispositivo, nessun evento in
`pending/dispatching/sent`, `civic_push_delivery_guard.blocked=true`;
`public.iniziative_ministero` ancora vuota. La fonte Ministero era
raggiungibile nell'ultimo audit con 87 record, ma il PC remoto è ora
offline e l'endpoint pubblico non risponde dall'ambiente di esecuzione.
Non riutilizzare il vecchio snapshot per inserirlo nel database:
richiedere una nuova lettura e validazione completa prima del primo
caricamento atomico. Questo è un blocco di connettività, non
un'autorizzazione a cambiare produzione, segreti o Render.

Prossimo gate: ripristino accesso alla fonte, import atomico solo
Demos-Staging con cache iniziale e outbox storica `suppressed`,
verifica duplicati e classificazione ufficiale, test Android/FCM 0/6.
Nessun FCM, cron, deploy o GO release autorizzato da questo file.
