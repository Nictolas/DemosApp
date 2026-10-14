# ✅ Soluzione Finale per la Migrazione

## Situazione Attuale

1. ✅ **Token Axiom**: il token configurato deve avere i permessi corretti (Ingest + Query)
2. ❌ **Problema SDK Locale**: l'SDK Axiom in locale non rispetta la regione EU
3. ❌ **Problema Render**: il modulo `pg` non viene trovato su Render

## Soluzioni Possibili

### Opzione 1: Usare il Token Corretto (Se diverso)

Se il token nel `.env` (`xaat-...`) è diverso dal token atteso:

1. **Crea un nuovo token su Axiom:**
   - Vai su https://app.axiom.co/demos-institute-jrim/settings/api-tokens
   - Clicca "New API token"
   - Nome: "Migration Token"
   - Permessi: seleziona **Ingest** e **Query** sotto "All datasets"
   - Copia il token

2. **Aggiorna il `.env` / secret manager:**
   ```
   AXIOM_API_TOKEN=nuovo-token-qui
   ```

3. **Aggiorna anche su Render:**
   - Vai su Render Dashboard → Environment
   - Aggiorna `AXIOM_API_TOKEN` con il nuovo token

### Opzione 2: Risolvere il Problema `pg` su Render

Il modulo `pg` è nel `package.json` ma Render non lo trova. Possibili cause:

1. **Verifica Build Command su Render:**
   - Vai su Settings → Build & Deploy
   - Build Command dovrebbe essere: `npm install`
   - Se è diverso, cambialo

2. **Verifica che `package.json` sia nella root prevista dal servizio:**
   - Render deve installare le dipendenze nella directory corretta

3. **Forza reinstallazione:**
   - Vai su Settings → Manual Deploy
   - Seleziona "Clear build cache & deploy"

### Opzione 3: Eseguire Migrazione su Render Shell (Se disponibile)

Se hai accesso a Render Shell:

```bash
cd /opt/render/project/src
node scripts/migrate-neon-to-axiom.js migrate
```

## Sicurezza

Non inserire mai nella documentazione o nel repository token reali, prefissi identificativi di token attivi, password, salt di produzione o URI database con credenziali. Usa sempre placeholder e conserva i valori reali solo nei secret manager.
