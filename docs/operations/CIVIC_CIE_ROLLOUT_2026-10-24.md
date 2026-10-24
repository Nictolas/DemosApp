# DEMOS — abilitazione CIE per azioni civiche

## Decisione 24 ottobre 2026
Nella fase iniziale gli utenti autenticati possono utilizzare le azioni civiche DEMOS senza verifica CIE, compresa la selezione di rappresentanti/candidati. Per ora la verifica CIE rimane facoltativa.

## Unico interruttore backend per le azioni
- `DEMOS_CIVIC_IDENTITY_MODE=progressive` (default in caso di variabile assente): l'autenticazione resta richiesta, ma il middleware `requireVerifiedCivicIdentity` consente l'azione senza verifica CIE.
- `DEMOS_CIVIC_IDENTITY_MODE=cie_required`: per utenti ordinari il middleware richiede una verifica CIE reale e valida prima delle azioni già protette. Per il solo amministratore esiste un'eccezione temporanea preesistente.
- Valori diversi da quelli supportati bloccano le azioni con risposta 503 (non disattivano la verifica).
- Configurare **soltanto nel backend** la variabile e distribuire/riavviare il servizio per applicarla. Non serve aggiornare l'app Android. Non c'è un interruttore pubblico modificabile da utenti.
- `DEMOS_REGISTRATION_IDENTITY_MODE` è **distinto**: controlla la CIE prima di creare un nuovo account. Mantenerlo `progressive` finché non si decide esplicitamente anche un requisito di registrazione.

## Perimetro e sicurezza
Il bypass temporaneo è limitato alla verifica CIE nel middleware delle azioni civiche. Non elimina login, validazione di sessione, consenso al trattamento delle opinioni politiche, controlli sulle giurisdizioni, ruoli, permessi amministrativi, o verifiche aggiuntive richieste da funzioni particolari.

**I dati delle azioni compiute durante la fase iniziale NON attestano un'identità CIE verificata.** Non attribuirgli status di voto ufficiale autenticato. La riattivazione del requisito CIE agisce sulle nuove azioni, non verifica retroattivamente scelte già registrate; prima dell'attivazione generale va definito come distinguere/trattare i dati pre-CIE, comunicare agli utenti il cambiamento e collaudare il provider CIE reale.

## Verifiche di regressione
- Utente autenticato ordinario senza CIE: può eseguire azioni con policy progressiva.
- Senza autenticazione: rimane 401.
- Policy stretta: senza CIE è 403, CIE verificata consente il passaggio, guasto alla verifica fallisce chiuso.
- Policy sconosciuta: fallisce chiusa.
- Le route mantengono middleware di autenticazione e consenso già presenti; nessuna modifica ai privilegi del DPO o Admin.
