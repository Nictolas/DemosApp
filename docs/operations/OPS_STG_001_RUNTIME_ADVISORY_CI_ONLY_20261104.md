# DEMOS 10 / T-55 — Test advisory lock applicativi su PostgreSQL effimero

**Ambiente autorizzato:** solo GitHub Actions, PostgreSQL 16/17, database civic_ci su container temporaneo. Il test rifiuta connessioni al database condiviso, a produzione o a un database locale preesistente prima di aprire connessioni.

Il test usa due sessioni PostgreSQL distinte, imposta il ruolo sintetico e limitato demos_staging_runtime e forza il default read-only. Controlla l'acquisizione di un session-level advisory lock dalla prima connessione, il rifiuto della seconda, la persistenza dopo BEGIN READ ONLY / ROLLBACK, il rilascio e la nuova acquisizione della seconda. Nel cleanup rilascia gli advisory lock e chiude entrambe le connessioni.

Non crea utenti, eventi o preferenze, non scrive tabelle e non invia FCM. Non riporta PID, URL, token o credenziali.

**Portata del risultato:** valida semantica e isolamento del lock per il ruolo applicativo su PostgreSQL effimero 16/17, ma non la continuità su Supavisor session mode nello staging reale, né l'autorizzazione al runtime Render.

**Gate ancora aperti:** test autorizzato del ruolo applicativo e advisory lock sul pooler reale, prova di invio FCM con opt-in e revoca, attivazione controllata delle fonti ECI/Ministero. T-55 generale resta PARZIALE, 0/6 E2E civici, release NO-GO. Non modificare il servizio LIVE per questo test.