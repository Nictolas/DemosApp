'use strict';
/** Read-only public API health probe; no person names/ballots are logged. */
const axios = require('axios');
const base = 'https://data.europarl.europa.eu/api/v2';
const urls = [
  base + '/meetings/MTG-PL-2026-07-09/vote-results',
  base + '/meetings/MTG-PL-2026-07-09/decisions',
  base + '/meetings/MTG-PL-2026-10-22/vote-results',
  base + '/meetings/MTG-PL-2026-10-22/decisions'
];
(async () => {
  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        timeout: 15000, maxContentLength: 4 * 1024 * 1024,
        maxRedirects: 0, proxy: false,
        headers: { Accept: 'application/ld+json,application/json' }
      });
      const obj = response.data;
      const entries = Array.isArray(obj) ? obj : obj?.data || obj?.['@graph'] || obj?.results || [];
      const first = entries?.[0] || {};
      console.log('EP_PUBLIC_API_READ_ONLY', JSON.stringify({
        path: new URL(url).pathname,
        status: response.status,
        contentType: response.headers['content-type'],
        count: Array.isArray(entries) ? entries.length : null,
        keys: Object.keys(first).slice(0, 35),
        rootKeys: Array.isArray(obj) ? [] : Object.keys(obj || {}).slice(0, 12)
      }));
    } catch (error) {
      console.log('EP_PUBLIC_API_UNAVAILABLE', JSON.stringify({
        path: new URL(url).pathname,
        httpStatus: error.response?.status || null,
        code: error.code || null
      }));
    }
  }
})();
