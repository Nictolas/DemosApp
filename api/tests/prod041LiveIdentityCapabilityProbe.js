'use strict';

// Read-only, non-blocking source-capability diagnostic. No personal names,
// individual statuses, roster HTML or full identifiers are logged or saved.
// Run only in CI; never connect to Supabase, Render or DEMOS users.
const axios = require('axios');
const cheerio = require('cheerio');
const { parseVerifiedFinalBallots, sourcePersonHref } = require('../services/parliamentVerifiedFinalBallotsService');

const SOURCES = [
  {
    chamber: 'Camera', voteId: 'vs19_739_14', voteDate: '2026-11-05',
    url: 'https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?CDDNATURA=FINALE&Legislatura=19&RifVotazione=739_14&tipo=dettaglio',
    header: 'nominativo,gruppo,voto'
  },
  {
    chamber: 'Senato', voteId: '19-469-6', voteDate: '2026-10-28',
    url: 'https://parlamento19.openpolis.it/votazioni/19-469-6',
    header: 'senatore,voto,gruppo'
  }
];
const NORMALIZE = value => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function probe(source) {
  const response = await axios.get(source.url, {
    timeout: 14000,
    maxRedirects: 0,
    maxContentLength: 2000000,
    validateStatus: status => status === 200,
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'DEMOS/1.0 (read-only identity-link compatibility test; https://demos.community)' }
  });
  const bytes = Buffer.from(response.data);
  if (bytes.length < 200 || bytes.length > 2000000) throw Error('INVALID_RESPONSE_LENGTH');
  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  const encoding = source.chamber === 'Camera' && !contentType.includes('utf-8')
    ? 'windows-1252' : 'utf-8';
  const html = new TextDecoder(encoding).decode(bytes);
  const $ = cheerio.load(html);
  let matchedTables = 0, rows = 0, explicitHref = 0, trustedSourcePerson = 0;
  $('table').each((_,table) => {
    const headers = $(table).find('tr').first().find('th,td')
      .toArray().slice(0, 3).map(x => NORMALIZE($(x).text())).join(',');
    if (headers !== source.header) return;
    matchedTables++;
    $(table).find('tr').slice(1).each((_,tr) => {
      if ($(tr).find('td').length < 3) return;
      rows++;
      const href = $(tr).find('td').first().find('a[href]').first().attr('href');
      if (href) explicitHref++;
      if (sourcePersonHref(href,source.chamber)) trustedSourcePerson++;
    });
  });
  let parsed = false, checkedMembers = 0, checkedSourceIds = 0, parserError = null;
  try {
    const result = parseVerifiedFinalBallots(html,{
      openpolis_id:source.voteId, camera:source.chamber, data_votazione:source.voteDate
    });
    checkedMembers=result.members.length;
    checkedSourceIds=result.members.filter(m=>Boolean(m.sourcePersonId)).length;
    parsed=true;
  } catch (e) {
    parserError=String(e?.message||'UNKNOWN').slice(0,100);
  }
  return {chamber:source.chamber,tableMatches:matchedTables,rows,
    explicitPersonAnchorRows:explicitHref,trustworthyPersonLinkRows:trustedSourcePerson,
    parsed,checkedMembers,checkedSourceIds,parserError};
}

async function main() {
  if (process.env.GITHUB_ACTIONS!=='true') throw Error('REFUSE_NON_CI_LIVE_PROBE');
  for (const source of SOURCES) {
    try {
      const result=await probe(source);
      // Aggregates only: do not leak names, votes or person ID text.
      console.log('PROD041_LIVE_IDENTITY_CAPABILITY '+JSON.stringify(result));
      if (!result.parsed || result.checkedSourceIds===0) {
        console.log('::warning::PROD041_LIVE_IDENTITIES_UNVERIFIED_'+source.chamber.toUpperCase());
      }
    } catch (e) {
      const reason=String(e?.code||'HTTP_FETCH_FAILED').replace(/[^A-Z0-9_]/gi,'_').slice(0,80);
      console.log('::warning::PROD041_LIVE_PROBE_INCONCLUSIVE_'+source.chamber.toUpperCase()+'_'+reason);
    }
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
