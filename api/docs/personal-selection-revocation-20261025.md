# DEMOS — Letture delle selezioni politiche dopo revoca (25 ottobre 2026)

**Stato:** proposta tecnica in PR DRAFT concatenata alla #287. Nessun merge o deploy.

## Difetto verificato

I GET autenticati di candidati e rappresentanti (/api/candidati, /api/candidati/selezioni, /api/rappresentanti e /api/rappresentanti/disponibili) leggevano le selezioni politiche personali tramite loadPoliticalSelections anche dopo la revoca del consenso Art. 9. Una preferenza residua in political_selections o negli adattatori legacy poteva quindi ricomparire nella risposta. Alcune letture registravano anche ID, nomi e interi payload delle selezioni nei log. Le route applicavano già Cache-Control: private, no-store: tale comportamento è preservato.

## Modifica proposta

- Le due proiezioni personali verificano il consenso del **proprietario** prima di caricare i voti e nuovamente dopo il caricamento. Se revocato, i campi storici sono restituiti nulli senza interrogare i record dei voti.
- Una verifica finale prima della serializzazione dei GET elimina i dettagli dei candidati/rappresentanti e le mappe di ID anche quando la revoca si conclude durante le query sui dettagli.
- Sono conservate le forme JSON preesistenti, con oggetti vuoti e null per selezioni non disponibili, senza estendere accessi a dati istituzionali. Rimossi i debug log delle preferenze personali.
- Nessuna cancellazione di dati o modifica agli endpoint di scrittura: base giuridica, eventuale cancellazione in cascata, tempi di conservazione e visibilità delle selezioni vanno decisi formalmente dal titolare/DPO.

## Verifica e limiti

Test unitari sulle funzioni e sui due GET, oltre a prova con vere SELECT in PostgreSQL 17 locale nella CI, fixture TEMP, soli UUID sintetici, override revocato e rollback finale. La CI non usa Supabase, Render o account personali.

La verifica prima/dopo non può ritirare risposte già inviate e comporta letture DB aggiuntive: misurare volume e latenza dopo l'integrazione. Devono essere verificate le altre superfici di profilo, la revoca/erasure di political_selections e user_representatives, le scritture concorrenti delle selezioni e le cache su Android/CDN. La DPIA nel repository è v1.1 con allegato tecnico in bozza, non collegata a un parere e una firma formalmente identificabili.

**Nessun merge, deploy, modifica produzione o accesso a dati reali.**
