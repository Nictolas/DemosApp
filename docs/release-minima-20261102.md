# DEMOS — release minima entro il 2 novembre 2026

Verifica del 28 ottobre 2026. **Preparazione tecnica, decisione di rilascio NO-GO.**
Fonte operativa: [CHECKLIST MASTER](https://docs.google.com/spreadsheets/d/1o7gI3m2Mbs2NRQtoyVh3DZW-7jlQinZgC-ou9Nc-q10/edit#gid=1930281028), letta in sola lettura. Nessun aggiornamento degli stati canonici è implicito in questo documento.

## Conteggio e perimetro

Le righe di peso 1 sono effettivamente **240**, delle quali **52** hanno `Chiuso (calcolo)=1`: **21,7% documentale**. Il testo introduttivo del foglio cita 256 attività: è un'incoerenza descrittiva, non un motivo per cambiare il denominatore. Le PR, issue, sottoattività e gate hanno peso zero. Nessun task canonico aggiuntivo è chiuso da una correzione Draft o da test sintetici.

La classificazione preliminare del foglio include 45 canonici indispensabili, 70 da valutare e 125 rinviabili. Dei 45, 7 risultano documentati come fatti (**15,6% documentale del sottoinsieme**, non readiness). Questo insieme include iOS e attività Store: non rappresenta automaticamente il perimetro Android minimo. I 14 gate REL restano senza attestazione completa di chiusura; nessuna percentuale di readiness è certificata.

| Pacchetto indispensabile | Task canonici | Evidenza necessaria per chiudere |
| --- | --- | --- |
| Privacy e diritti | F5-12/13/14/17/18/20, F6-11/14/15 | Informative e retention approvate; ciclo consenso→revoca→cancellazione, ricevute e recovery provati su staging sintetico autorizzato |
| Accesso | F6-02/16/17/19 | Google/Passkey, sessioni e cambio account sulla build finale; riconciliare requisito CIE e policy runtime |
| Funzioni core | F12-13/16/17/18/20/28/29/36 | Opinioni, Sondaggi, rappresentanti, profili pubblici e notifiche senza regressioni o residui dopo revoca |
| Android RC | F6-21, F8-01/02/03/05/07/08/10/11/13/14/15/18, F9-01/03/05/06/07 | AAB identificato, firmato da operatore autorizzato, hash/certificato e canale Play verificati, test dispositivi reali |
| Decisione finale | F9-08/09/12/13/14 e REL-01…14 applicabili | Sign-off esplicito, piano rollback e rollout autorizzato |

Rinviare dall'Android minimo: iOS/Apple/TestFlight (F6-18/20, F8-04/06/09/12/16/17/19, F9-02/04/10/11), push nativo FCM aggiuntivo ove non necessario alla funzione già disponibile, upgrade major non necessari (GH-161), codec sperimentale #247, Forum/Tutorial/Tasso di Coerenza (F12-09/10/11). Non reimplementare OP-37/Sondaggi già merged (#258), scheduler Axiom→B2 o funzionalità già presenti nei Draft. Il triage AI aggiuntivo F12-34 non deve espandere lo scope se non necessario a chiudere un finding di sicurezza concreto; la classificazione preliminare del foglio richiede questa valutazione.

## Stato GitHub prima delle correzioni

`main`: `e98153f44d41445d4e47d5d6195366ab11cf7885`; 125 PR aperte rilevate. L'unico check su questo HEAD è **Sync ECI FAILURE**, run [40633699983](https://github.com/Nictolas/DemosApp/actions/runs/40633699983), step `Sincronizza ECI su Neon`. Non è una CI complessiva verde di main; non sono stati letti segreti, payload di log o dati provider e non è stata rieseguita una sincronizzazione live.

| PR | HEAD verificato iniziale | Workflow su HEAD | Dipendenza |
| --- | --- | --- | --- |
| #366 | 44497f6 | 2/2 SUCCESS | main |
| #371 | d8e0c1b | 4/4 SUCCESS | #366 |
| #372 | 3c83c30 | 3/3 SUCCESS | #371 |
| #373 | 3c90cef | 4/4 SUCCESS | #372 |
| #374 | 2b78845 | 3/3 SUCCESS | #373 |
| #375 | 4f3aa92 | 1/1 SUCCESS | main |
| #376 | fba7516 | 2/2 SUCCESS | #375 |

Tutte OPEN/Draft e mergeable alla lettura iniziale. Le descrizioni iniziali di #366 e #376 contengono HEAD storici: usare SHA e check effettivi. Due catene distinte: `main→#366→#371→#372→#373→#374` e `main→#375→#376`. Non esiste ancora una RC che integri entrambe e provi i loro effetti combinati. Il fatto che main sia comune non prova compatibilità completa.

#295 `b4a5a62` ha regressioni privacy/selezioni/cancellazione verdi ma `Integration history and patch hygiene` rosso: non trattarlo come difetto funzionale già risolto o duplicare la catena storica. #286 contiene già la correzione profili pubblici: i test di main non ne attestano l'integrazione. #177 è troppo arretrato (Android 1.0.6/v8) per ospitare in sicurezza il fix della CI Android corrente (1.0.10/v12).

## Correzione del gate Android

La CI Android verificava ancora `versionCode 11` / `versionName 1.0.9`, mentre la versione sorgente è già 1.0.10/v12 (PR #257 merged). Il pacchetto corregge questo blocco senza cambiare versione, signing o configurazione applicativa: confronta versione e package compilati (metadata dell'APK debug) con `app/build.gradle` e ricava dalla stessa identità il nome dell'AAB unsigned archiviato. Le asserzioni rifiutano output obsoleto, package diverso, versioni ambigue o valori non sicuri per l'output CI.

Verifiche locali: **3/3** regressioni del guard di identità, **4/4** contratti Android auth/push, **5/5** contratti navbar; **15/15** asset launcher coincidono con l'icona attesa. Syntax e `git diff --check` PASS. JDK 21 disponibile, SDK Android locale assente: la compilazione APK/AAB deve essere verificata dalla CI sull'HEAD finale. Il controllo del metadata debug non è un'attestazione crittografica del manifest AAB firmato o del pacchetto distribuito da Play.

## Follow-up Sostenitori — stessa PR di preparazione

La pagina personale richiedeva il totale pubblico, che sopprime intenzionalmente i conteggi Politico/Candidato. Ora richiede `/api/sostenitori/totale-privato` tramite il client autenticato esistente. Nessun cambiamento ai ruoli abilitati o alla visibilità pubblica. Il percorso privato invia `private, no-store, max-age=0` prima dell'autenticazione, anche su 400/401/403/500; un errore DB non stampa più il dettaglio grezzo nei log. La lettura di `user.ruolo` durante il primo render senza sessione è protetta, preservando l'ordine degli hook.

Regressioni: HTTP con router Express reale, DB/auth sintetici, proprietari, Admin effettivo, utenti diversi (anche con sola etichetta legacy AD), soppressione pubblica e errori senza conteggi fittizi. Test frontend di rendering e contratto della query, più regressione esistente del percorso privato. Tutte le nuove prove sono incluse nel workflow Android, insieme alla build APK/AAB.

Collegamento canonico F12-20 e gate REL-08/09: miglioramento tecnico, nessuna nuova chiusura canonica. Le query aggregate ereditate usano ancora le selezioni legacy: questo intervento non sostituisce i Draft già esistenti per filtro consenso/selezioni canoniche e non attesta il comportamento integrato dopo revoca. Provider, firma e prove fisiche restano fuori da queste regressioni.

## Blocchi che i test locali non chiudono

- Issue [#296](https://github.com/Nictolas/DemosApp/issues/296) **OPEN / recovery NO-GO**: identità e ACL del writer SQL effettivo, staging isolato, B2 indipendente (versioni/Object Lock/checkpoint fresco), replay prima del traffico e drill di recovery autorizzato.
- DPIA, retention e procedure DPO/titolare; una durata arbitraria o una CI FakeB2 non sostituiscono l'approvazione.
- Policy F6-16 da riconciliare: la checklist richiede CIE per azioni sensibili, mentre il default runtime `progressive` consente accesso senza CIE e il modo `cie_required` è esplicito. Nessuna modifica autonoma di policy.
- Regressioni su main, build finale firmata, prove fisiche Android, accessibilità e flussi Store. Un AAB CI unsigned non è F8-15 completato.
- Scroll indesiderato nella selezione rappresentanti Android: **in attesa di dettagli di riproduzione**, nessuna correzione speculativa.

## Sequenza proposta verso il 2 novembre

1. 28–29 ottobre: completare review e CI sugli HEAD finali dei pacchetti correttivi; selezionare le sole dipendenze necessarie e preparare un piano d'integrazione da autorizzare, senza merge automatici.
2. 29–30 ottobre: previa autorizzazione specifica, verificare staging realmente isolato, writer SQL e prove indipendenti B2; eseguire ciclo privacy/recovery con soli dati sintetici e traffico chiuso. Riconciliare policy legali e CIE.
3. 30–31 ottobre: dopo approvazione dell'integrazione, qualificare auth/Opinioni/Sondaggi/rappresentanti/notifiche sulla stessa RC e provare Android reale; correggere solo blocker riproducibili.
4. 1 novembre: congelare SHA, build/versione/hash e materiale di rollback; signing e caricamento Play soltanto con autorizzazione specifica.
5. 2 novembre: decisione esplicita GO/NO-GO basata sui gate. Se resta un gate privacy/sicurezza aperto, mantenere NO-GO e ripianificare il rilascio pubblico.

Nessun merge, deploy, scrittura in produzione, accesso a segreti o dati personali, modifica Render/Supabase/B2 reale o restore provider è autorizzato da questo piano.
