# DOC-063 · Protezione dal fallback e dal sovraccarico di Sondaggi

24 ottobre 2026. PR [#258](https://github.com/Nictolas/DemosApp/pull/258) in **bozza**; nessun merge e nessun deploy della nuova modifica.

## Rischio trovato

L'implementazione iniziale del formato TEXT aggregato prevedeva un fallback verso due query per opinione **per qualunque errore** della query aggregata. In caso di indisponibilità, timeout, permessi insufficienti o esaurimento delle connessioni, un singolo GET sarebbe potuto passare dalle 3 query nominali a molte query aggiuntive, amplificando un problema del database.

## Correzione e prova

Il file `api/utils/sondaggiTextBulk.js` applica ora `eligibleForLegacyFallback(error)` alle **prime** eccezioni del percorso bulk (nazionale, regionale, provinciale e comunale). Consente di avviare il percorso legacy soltanto per SQLSTATE statici di incompatibilità `0A000`, `42601`, `42883`, `42703`. Altrimenti propaga l'errore al gestore HTTP, anziché effettuare le letture per opinione. Il codice mantiene la soglia aggregata di almeno 10 e il controllo del consenso PERSON.

I test `api/tests/sondaggiTextBulk.test.js` eseguono entrambi i percorsi, nazionale e territoriale, con errori simulati `53300`, `57014`, `08006`, `57P01`, `42501`, `ECONNRESET`, `XX000` e verificano **esattamente due tentativi SQL nel helper** (lettura metadati + aggregato, senza fanout), oltre al test dei quattro codici che autorizzano il fallback. Le prove di fallback controllato marcano l'errore simulato come `0A000`; il test HTTP reale su PG17 sintetico lo ripete.

Risultati sul commit [`ad1f305`](https://github.com/Nictolas/DemosApp/commit/ad1f3055e30599ec323435138b8eb9f17841e2ac): [GitHub Actions #40118618910](https://github.com/Nictolas/DemosApp/actions/runs/40118618910) **SUCCESS**.

## Limiti e blocchi rimasti

- Questa protezione evita il **primo fanout da un errore del percorso bulk**. Il fallback legacy avviato legittimamente può ancora incontrare successivi errori di connessione a metà ciclo; servono ulteriori test e limiti prima di affermare una protezione completa da ogni tempesta di query.
- Risultati CI non equivalgono a monitoraggio del carico di Supabase in produzione, né a p50/p95 HTTP Render→Supabase.
- Il servizio Render di staging resta in `setup-only`, senza credenziali. Il ruolo `op37_http_staging_reader` su Demos-Staging rimane `NOLOGIN` e `default_transaction_read_only=on`.
- La configurazione temporanea credenziali Render/Supabase non è stata completata e il trasferimento automatico fra servizi è stato bloccato: non aggirarlo.
- Nessuna modifica allo schema di produzione, nessuna release Android, nessun merge; la PR #247 (2 bit) resta separata.

**Prossima verifica:** testare anche le interruzioni durante il fallback legittimo e, solo dopo la configurazione sicura manuale del ruolo staging, misurare l'HTTP completo prima di decidere il rilascio.
