# DEMOS — Letture dei voti ministeriali e Governo ideale (25 ottobre 2026)

**Stato:** proposta in bozza, concatenata alla PR #283. Nessun merge o deploy.

## Difetti individuati nel codice

`GET /api/governo/voti` costruiva le classifiche direttamente dalle righe di ciascuna tabella `voti_<ministero>` senza verificare il consenso politico degli utenti. Inoltre restituiva `mieiVoti`, date/limiti di modifica (`blocchi`) anche se il consenso del richiedente era revocato. `GET /api/governo/ideale` restituiva le preferenze individuali nonostante la revoca e le stampava nei log. Entrambi gli endpoint richiedevano autenticazione ma mancavano direttive HTTP `no-store` esplicite. La cache frontend `governoVoti` era già stata isolata per account e pulita dalla PR #283, ma tale misura non sostituisce i controlli server.

## Mitigazioni

- Entrambi i GET impostano `Cache-Control: private, no-store, max-age=0` **prima** del middleware di autenticazione e anche sugli errori. Il prefisso `/api/governo/` è già nell'elenco bypass CDN configurabile.
- Nelle classifiche, ogni SELECT unisce `users` e `user_consents` e conta **solo** i voti con consenso Art. 9 attivo, con prevalenza dell'override di `user_consents`.
- In `/voti`, le preferenze individuali sono filtrate **nella medesima SELECT SQL** che legge il voto. Se il consenso manca, si evita la lettura dei voti personali e dei dati cooldown; per compatibilità `mieiVoti` resta un oggetto vuoto, `blocchi` contiene i ministeri con stato non bloccato e `blocco` è non bloccato.
- In `/ideale`, il consenso è controllato prima di accedere ai voti e **nella stessa SELECT** di ogni scelta personale. Senza consenso la risposta resta `{success:true,data:{}}`.
- Un'ulteriore verifica del consenso prima di preparare la risposta azzera la sezione personalizzata se una revoca si conclude nel frattempo. Non è una serializzazione delle letture avviate contemporaneamente alla revoca.
- I nomi delle tabelle provenienti da una **allowlist letterale di ministeri** non possono essere forniti dall'utente. Se manca una vecchia tabella ministeriale (SQLSTATE `42P01`), la relativa sezione resta vuota come prima; gli altri errori database restituiscono un 500 sanitizzato senza dati parziali.
- Eliminati log di voti, identificativi, cooldown ed errori SQL in entrambe le letture. Nessuna modifica alle operazioni di scrittura.

## Verifiche

Nuovi test unitari con i veri handler estratti dal sorgente: classifiche filtrate, consenso attivo/revocato, revoca durante la lettura, errore PostgreSQL, assenza di tabelle legacy, risposta anonimizzata 401 e politica CDN. Script dedicato di integrazione PostgreSQL 17 **solo locale CI**, con 14 tabelle `TEMP`, due account interamente sintetici, preferenze attive e revocate rimaste nel database, verifiche `GET /voti` e `GET /ideale` e rollback finale. Lo script rifiuta credenziali o ambienti che non siano la configurazione CI sintetica.

## Rischi residui e gate

Una revoca completata *dopo* la verifica finale della singola risposta può restare soggetta alle normali condizioni concorrenti di rete; per invalidare i dati già visualizzati occorrono la pulizia cache e il comportamento client. Le classifiche con pochi votanti potrebbero consentire inferenze e richiedono una valutazione delle soglie/visibilità. Non sono state effettuate prove fisiche Android né verifiche delle regole Cloudflare effettivamente distribuite. È necessaria una revisione integrata della catena PR #264–#284 prima del rilascio. Il DPO interlocutore ha dichiarato l'approvazione della DPIA; la versione specifica, le revisioni e i rischi residui devono essere collegati nel registro documentale.

**Nessun merge, deploy, accesso a dati personali reali o modifica alla produzione.**
