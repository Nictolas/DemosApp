# DEMOS — Profilo pubblico di candidati/politici e Governo ideale (25 ottobre 2026)

**Stato:** modifica proposta su PR *draft*, base PR #284. Nessun merge né deploy.

## Lacuna individuata

`GET /api/users/:userId/public-profile` espone, a chiunque sia autenticato, le selezioni del “Governo ideale” di politici e candidati. Il metodo `loadIdealGovernment` leggeva direttamente le tabelle `voti_<ministero>` **senza verificare il consenso esplicito al trattamento dei dati politici**. Tali tabelle sono in `CONSENT_SCOPED_TABLES` e sono soggette a cancellazione nella revoca. Se righe residue restavano nel DB o una revoca era in corso, il profilo pubblico poteva ancora mostrarle. Mancava una direttiva HTTP `Cache-Control: no-store` e il catch dell'handler loggava l'oggetto errore DB (potenzialmente dettagli SQL/ID).

Il ruolo pubblico di politico/candidato non costituisce automaticamente un consenso al trattamento delle preferenze politiche espresse sull'app. La proiezione degli incarichi/identificazioni pubbliche resta un ambito separato.

## Correzione proposta

- `Cache-Control: private, no-store, max-age=0` impostato **prima dell'autenticazione**, inclusi 401, 404 e 500; la policy CDN esistente esclude già `/api/users/` dalle cache.
- `loadIdealGovernment` verifica il consenso politico del **soggetto target**, non del visitatore. Se manca, restituisce `{}` senza interrogare le tabelle ministeriali.
- Ogni `SELECT` ministeriale unisce `users` e `user_consents` e applica l'override `COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) IS TRUE` **nella stessa istruzione SQL** che legge la preferenza, anche in presenza di dati residui.
- Al termine del caricamento del profilo, un'ulteriore verifica del consenso del target elimina `governoIdeale` dalla risposta qualora la revoca si sia conclusa durante l'esecuzione. Il payload conserva la forma `public.governoIdeale: {}`; nome, ruolo pubblico, candidature e rappresentanti non vengono modificati.
- Per le installazioni legacy senza una singola tabella ministeriale, `42P01` continua a non interrompere il profilo. Gli altri errori non producono una proiezione politica parziale e non vengono registrati con valori o stack SQL.

## Test

- Test unitari sintetici sulla route reale: consenso attivo, target revocato, revoca durante il caricamento, account non pubblico/inesistente, 401, errore SQL sanificato, schema legacy, HTTP no-store.
- Regressione aggiornata del profilo pubblico, con struttura JSON mantenuta.
- Test PostgreSQL 17 sintetico e isolato: tabella `users`, `user_consents` e tabelle di voto tutte `TEMP`; caso con consenso attivo, voto residuo di utente revocato, revoca dopo lettura, fallback legacy e tabella ministeriale assente. `ROLLBACK` finale. Guardia su database e credenziali rifiuta ambienti non CI/locali.
- Suite precedente privacy e build web mantenute.

## Rischi residui e condizioni di rilascio

Il controllo finale del consenso non serializza una risposta già inviata con una revoca successiva; pulizia cache e cancellazione locale restano essenziali. Le **selezioni di rappresentanti/candidati** riportate nel profilo pubblico provengono da colonne e tabelle diverse: non vengono modificate qui e richiedono una separata decisione di perimetro e minimizzazione GDPR. Le classifiche con pochi votanti possono comportare inferenze. Prima di un'eventuale integrazione delle PR #264–#285: review consolidata, prove manuali Android/Cloudflare e aggiornamento del registro DPIA con la versione di documento alla quale il DPO ha dichiarato l'approvazione.

Nessun merge, deploy, modifica alla produzione o accesso a dati personali reali.
