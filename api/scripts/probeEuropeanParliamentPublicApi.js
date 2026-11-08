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
      if (url.includes('/vote-results') && Array.isArray(entries)) {
        console.log('EP_VOTE_RESULT_LABEL_EXAMPLES', JSON.stringify(entries.slice(0, 3).map(d => ({
          id: d.activity_id,label:d.activity_label,kind:d.had_activity_type,
          consists_of: d.consists_of,structuredLabel:d.structuredLabel
        }))));
      }
      if (url.includes('/decisions') && Array.isArray(entries)) {
        const rollCalls = entries.filter(d => d.had_voter_favor || d.had_voter_against || d.had_voter_abstention);
        function brief(value) {
          return { type: Array.isArray(value) ? 'array' : typeof value,
            count: Array.isArray(value) ? value.length : null,
            sample: Array.isArray(value) ? value.slice(0, 2) : value == null ? null : String(value).slice(0, 120) };
        }
        console.log('EP_DECISION_LABEL_EXAMPLES', JSON.stringify(rollCalls.slice(0, 9).map(d => ({
          id: d.activity_id, order: d.activity_order,
          label: d.activity_label, heading: d.headingLabel,
          about: d.decisionAboutId, method: d.decision_method,
          outcome: d.decision_outcome
        }))));
        for (const d of rollCalls.slice(0, 3)) {
          console.log('EP_DECISION_SHAPE', JSON.stringify({
            path: new URL(url).pathname,
            activity_id: brief(d.activity_id),
            method: brief(d.decision_method),
            outcome: brief(d.decision_outcome),
            activityType: brief(d.had_activity_type),
            label: brief(d.activity_label),
            voteId: brief(d.notation_votingId),
            favor: brief(d.had_voter_favor),
            against: brief(d.had_voter_against),
            abstention: brief(d.had_voter_abstention),
            note: brief(d.headingLabel)
          }));
        }
      }
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
