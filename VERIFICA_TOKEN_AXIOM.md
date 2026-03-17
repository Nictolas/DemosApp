# 🔍 Come Verificare i Permessi del Token Axiom

## Passi per Verificare il Token

1. **Vai su Axiom Dashboard:**
   - https://app.axiom.co/demos-institute-jrim

2. **Vai su Settings:**
   - Clicca sul tuo nome/organizzazione in alto a destra
   - Seleziona "Settings" o vai direttamente a: https://app.axiom.co/demos-institute-jrim/settings

3. **Vai su API Tokens:**
   - Nel menu laterale, cerca "API Tokens" o "Tokens"
   - Dovresti vedere la lista dei tuoi token

4. **Verifica il Token:**
   - Cerca il token che inizia con `xaat-e1be5dc4...`
   - Controlla che abbia questi permessi:
     - ✅ **Ingest** (per inviare dati)
     - ✅ **Query** (per leggere dati)
   - Se manca uno di questi permessi, devi creare un nuovo token

5. **Crea Nuovo Token (se necessario):**
   - Clicca "Create Token" o "New Token"
   - Nome: "Migration Token" o simile
   - Permessi: Seleziona **Ingest** e **Query**
   - Copia il token (lo vedrai solo una volta!)
   - Aggiorna `AXIOM_API_TOKEN` nel `.env` e su Render

## Verifica Org ID

1. **Vai su Settings → Organization**
2. **Copia l'Organization ID**
3. **Verifica che corrisponda a:** `demos-institute-jrim`

