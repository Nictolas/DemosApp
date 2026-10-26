# DEMOS — Precedenza dei dispositivi registrati sui token FCM legacy

**26 ottobre 2026 — proposta DRAFT stacked su PR #341 → #340 → #339 → #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302. Issue #296 aperta.**

## Problema confermato dal codice

`api/database/create-user-devices-table.sql` documenta `user_devices` come registro canonico dei token FCM attivi, con `UNIQUE(fcm_token)` e indice `(user_id,is_active)`. Il vecchio `users.fcm_tokens` rimane supportato per compatibilità.

In `api/services/currentSupporterPushService.js` la prima ricerca faceva l'**unione incondizionata** tra i dispositivi canonici attivi e l'array legacy. Il pre-invio autorizzava a sua volta il token quando presente **in almeno una** delle due sorgenti. Perciò un record `public.user_devices` disattivato (`is_active=false`) poteva essere riabilitato per sbaglio da una copia legacy. Analogamente un token trasferito a un nuovo `user_id` poteva essere ancora associato al vecchio account tramite l'array. I soli test del vincolo `is_active=false` nella PR #341 non coprivano tale conflitto simultaneo.

## Regola di precedenza

1. **Se in `public.user_devices` esiste un record di quel token, prevale sempre:** è idoneo solo se `is_active=true`, appartiene all'utente realmente consenziente e compare nella ricerca dei suoi dispositivi.
2. `public.users.fcm_tokens` è ammesso **solo se nessun record di quel token esiste nel registro canonico**, indipendentemente dallo stato e dal proprietario del record canonico. Questo tutela la transizione degli account con token legacy non ancora registrati.
3. La regola vale sia in `loadCurrentSupporterTokens` (discovery) sia in `isCurrentSupporterTokenEligible` (ricontrollo immediatamente prima di Firebase). Il confronto usa `btrim` su entrambe le forme per non aggirare la disattivazione introducendo spazi ai margini. Le altre condizioni su account attivo, consenso e token registrato rimangono invariate.
4. Se `public.user_devices` manca davvero (compatibilità `42P01/42703`), si applica il percorso di fallback legacy precedente, limitato allo schema `public`. Una tabella **mancante non consente di certificare** che un token sia disattivato nel registro assente; occorre censire i deployment legacy prima di un rilascio.

Nessuna modifica DDL, nessuna migrazione, nessun cambio dell'API, nessun token registrato o disattivato nei servizi reali.

## Prove PostgreSQL 17 fittizie

Estensione del drill `api/scripts/verify-supporter-notification-consent-ci.js` già protetto dalle sentinelle GitHub Actions, host localhost, database disposable e rollback:
- Il sostenitore `granted` conserva nell'array legacy **`' inactive-device '`**, mentre il record canonico di `inactive-device` ha `is_active=false`; discovery e pre-send devono **rifiutarlo**.
- Il sostenitore conserva anche `moved-device` nell'array legacy, mentre un record canonico attivo lo assegna all'account `subject`; il vecchio proprietario deve essere rifiutato, il nuovo proprietario può risultare idoneo.
- `token-granted` non ancora presente in `user_devices` resta ammesso con consenso valido e `device-granted` del dispositivo attivo resta ammesso.
- I dati sintetici aggiuntivi vengono ripristinati *nella stessa transazione* per mantenere indipendenti le successive prove di revoca e fallback.
- Sono mantenuti i test contro `pg_temp` omonime, revoca in corso e accesso indicizzabile ai dispositivi. Nuovo marcatore: `SUPPORTER_DEVICE_OVERRIDES_LEGACY_PG17_PASS`.

## Prestazioni e limiti

L'anti-join `NOT EXISTS` sul token usa `btrim(registered.fcm_token)`, più conservativo del semplice confronto esatto, ma **non necessariamente indicizzabile** con l'unico indice su `fcm_token` presente nella migrazione. Il costo della scansione e della verifica pre-invio non è stato misurato su dati reali; la PR non dichiara risparmi. Una normalizzazione provata dei token all'ingresso e un piano SQL sullo staging potrebbero consentire l'uso dell'indice esatto, ma non devono essere introdotti senza nuova analisi. Il test dell'indice `(user_id,is_active)` della PR #341 non copre questo anti-join sul token.

Rimane inoltre la race fra l'ultima SELECT e la consegna remota Firebase: non è un'operazione atomica e il provider potrebbe avere già ricevuto il messaggio.

**Issue #296 non risolta**: restano la completezza/freschezza/durabilità indipendente della cronologia degli eventi GDPR sino al freeze, la quarantena verificata Render/Supabase/Data API/worker, test reali B2 Object Lock/VersionId/retention su staging e le decisioni DPIA/titolare/DPO, retention e costi.

**Nessun merge, deploy, migrazione, accesso a dati reali/produzione, segreti, spese o servizi attivati.**
