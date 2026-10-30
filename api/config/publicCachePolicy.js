/**
 * Policy per Cloudflare CDN (Cache Rules / Page Rules).
 * Solo percorsi pubblici e idempotenti: non abilitare cache edge su route con dati
 * personali o autenticazione obbligatoria senza Vary/Authorization handling.
 *
 * Suggerimento: in Cloudflare creare una Cache Rule "Bypass cache" per /api/auth/*
 * e route admin; una regola "Cache Everything" o "Standard" con rispetto agli header
 * solo per i path elencati in cacheableApiGetPaths (e asset statici del client).
 */

module.exports = {
  /** GET API che possono essere cacheate a livello HTTP se l'origine invia Cache-Control appropriati */
  cacheableApiGetPaths: [
    {
      pattern: '/api/eventi/mobilitazioni',
      rationale: 'Catalogo pubblico anonimo Chrono; cache breve e senza dati personali. Questa eccezione esatta precede il bypass della famiglia /api/eventi.'
    },
    {
      pattern: '/api/statistiche/*',
      rationale: 'Aggregati pubblici; l\'API imposta Cache-Control breve quando Redis è attivo.'
    },
    {
      pattern: '/api/programma',
      rationale: 'Lista programmi pubblica; TTL breve lato origine e edge.'
    },
    {
      pattern: '/api/ministero/iniziative',
      rationale: 'Dati sincronizzati; no query string source=ministero (bypass diretto al Ministero).'
    }
  ],

  /** Non mettere in cache su Cloudflare (bypass o rispetta no-store dall\'origine) */
  neverCachePathPrefixes: [
    '/api/auth/',
    '/api/users/',
    '/api/user/',
    '/api/admin/',
    '/api/opinioni/',
    '/api/opinioni-list',
    '/api/notifiche',
    '/api/governo/',
    '/api/eventi', // ECCEZIONE: GET /api/eventi/mobilitazioni (pubblico e cacheabile)
    '/api/fcm-tokens',
    '/api/bacheca',
    '/api/voti-',
    '/api/riconoscimenti',
    '/api/programma/'
  ],

  /**
   * Asset statici del frontend (se serviti dallo stesso dominio o da bucket): massimo impatto CDN.
   * Esempio: *.js, *.css, /assets/* — configurare in Cloudflare in base al deploy reale.
   */
  staticAssetHints: ['*.js', '*.css', '*.woff2', '/assets/*', '/favicon.ico'],

  /**
   * Cloudflare KV: opzionale per blob JSON quasi statici (feature flag, config pubblica).
   * Non usare come sostituto della cache applicativa Redis per questi endpoint.
   */
  kvUseCasesNote:
    'KV solo per dati con consistenza eventuale accettabile; la cache lato DB resta su Redis (Upstash).'
};
