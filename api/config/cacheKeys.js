/**
 * Chiavi e TTL per la cache applicativa (Upstash Redis).
 * Self-host Redis: stesse chiavi se usi un client compatibile con comandi GET/SET/DEL.
 */

const PREFIX = 'demos:api';

module.exports = {
  PREFIX,
  keys: {
    statisticheUtenti: `${PREFIX}:statistiche:utenti`,
    statisticheOpinioni: `${PREFIX}:statistiche:opinioni`,
    programmiList: `${PREFIX}:programma:list`,
    programmaUser: (userId) => `${PREFIX}:programma:user:${userId}`,
    ministeroIniziativeDb: `${PREFIX}:ministero:iniziative:db`
  },
  /** secondi */
  ttl: {
    statistiche: parseInt(process.env.CACHE_TTL_STATISTICHE_SEC || '120', 10),
    programmiList: parseInt(process.env.CACHE_TTL_PROGRAMMI_LIST_SEC || '60', 10),
    programmaUser: parseInt(process.env.CACHE_TTL_PROGRAMMA_USER_SEC || '30', 10),
    ministeroIniziative: parseInt(process.env.CACHE_TTL_MINISTERO_INIZIATIVE_SEC || '300', 10)
  }
};
