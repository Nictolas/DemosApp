# DEMOS — accesso DPO limitato (PR #233)

## Stato verificato al 23 ottobre 2026
- Migrazione `dpo_readonly_capability_20261023` **applicata su Supabase produzione** `wxnblcqoyjqxktwkcqok`.
- Rilettura SQL: un solo account Admin attivo, **zero utenti con `is_dpo=true`**; vincolo `users_dpo_not_admin` presente.
- Il DPO dispone di un endpoint esclusivamente aggregato `GET /api/dpo/overview` e della pagina `/dpo`; le route `/api/admin` restano riservate a Admin.
- Il middleware verifica l'autorizzazione con una nuova query DB ad ogni richiesta; revoca del permesso = accesso negato al tentativo successivo.
- Tutti i test della PR #233 precedenti a questo aggiornamento hanno superato GitHub Actions, inclusi route HTTP Express con autenticazione *sintetica* e PostgreSQL 17 effimero.
- **Il merge/deploy e gli smoke test sulla produzione vanno verificati separatamente.** Non attribuire il ruolo DPO automaticamente.

## Rilascio controllato
1. Verificare che il branch PR #233 contenga route, middleware, nuova pagina e test.
2. GitHub: verificare checks richiesti e branch mergeable.
3. Render workspace **Nicolas**, servizi `demos-backend` (root `api`) e `demos-frontend` (root `client`), entrambi branch `main`, auto-deploy `commit`. Il merge su main attiva il deploy ordinario, da controllare esplicitamente.
4. Dopo la pubblicazione, verificare che `GET /api/dpo/overview` senza token restituisca 401. Senza ruolo DPO concesso, nessun utente ordinario deve poter entrare.
5. Il ruolo DPO richiederà in seguito incarico, identificazione univoca dell'utente e concessione `is_dpo=true` soltanto all'account verificato e non Admin.
6. Se un deploy fallisce, usare la procedura standard Render di ripristino della precedente versione sana. Non mutare la retention log né effettuare altre migrazioni non correlate.

## Account storico Admin
L'account senza email del 2025 è stato disattivato e ha perso `is_admin`, ma **non è stato eliminato**: conserva sei selezioni politiche. La cancellazione definitiva richiede percorso canonico PrivacyErasureLedgerService, verifica dipendenze e integrità privacy, senza trasferire o copiare opinioni in altri account.

## Perimetro giuridico
L'esistenza di un solo Admin applicativo non dimostra che il titolare sia l'unico amministratore di sistema tecnico; occorre inventario effettivo degli accessi Render/Supabase/GitHub/fornitori e valutazione GDPR/Garante prima di ridurre i log. PR #218 e retention RP-09, RP-10, RP-17 restano in revisione.
