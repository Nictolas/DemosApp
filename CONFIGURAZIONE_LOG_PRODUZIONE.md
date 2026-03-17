# Configurazione log in produzione

Per ridurre l’accumulo di log in produzione (es. visite alla pagina menu), imposta queste variabili nell’ambiente di produzione (file `.env` sul server o variabili d’ambiente in Vercel / altro hosting):

| Variabile | Valore | Effetto |
|----------|--------|---------|
| `NODE_ENV` | `production` | Disattiva i log di debug (UNIVERSAL LOG, middleware con metodo/path/Origin/Referer). |
| `GDPR_LOGGING_FILTER` | `true` | Invia ad Axiom/file solo i log rilevanti per il GDPR; le GET del menu (eventi/prossimo, iniziative-popolari/prossima, referendum-abrogativi/prossima) non vengono loggati. |

Sono già presenti con questi valori in `env.example` nella root del progetto. Se usi un hosting con dashboard (es. Vercel), aggiungi o verifica queste due variabili nella configurazione del progetto.

**In locale** puoi lasciare `NODE_ENV=development` (e opzionalmente `GDPR_LOGGING_FILTER` non impostato o `false`) per continuare a vedere i log di debug.
