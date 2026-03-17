# 🔧 Fix per Migrazione su Render

## Problema
Il modulo `pg` non viene trovato su Render quando si tenta di eseguire la migrazione.

## Soluzione

### Opzione 1: Riavvia il servizio su Render (Consigliato)

1. Vai su https://dashboard.render.com/web/srv-d2gt3dodl3ps73fmereg
2. Clicca su **"Manual Deploy"** → **"Deploy latest commit"**
   - Questo reinstallerà tutte le dipendenze incluso `pg`

### Opzione 2: Verifica dipendenze

Il modulo `pg` è già nel `package.json`, quindi dovrebbe essere installato. Se il problema persiste:

1. Vai su Render Dashboard → Settings
2. Verifica che il **Build Command** sia: `npm install`
3. Verifica che il **Start Command** sia: `npm start`

### Opzione 3: Esegui migrazione dopo riavvio

Dopo aver riavviato il servizio, esegui di nuovo:

```bash
node scripts/start-migration-with-login.js --confirm
```

## Note

- Render potrebbe aver bisogno di un riavvio per riconoscere le nuove dipendenze
- Il percorso dello script è stato corretto per funzionare sia in locale che su Render
- La migrazione funzionerà una volta che `pg` è disponibile su Render

