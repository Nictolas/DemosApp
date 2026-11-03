'use strict';
// Read-only, bounded HTML diagnostics for source-coverage gaps; no names, DB or credentials.
const axios = require('axios');
const cheerio = require('cheerio');
const cases = [
  ['vs19_718_024','2026-10-01'],
  ['vs19_714_031','2026-09-23'],
  ['vs19_710_001','2026-09-16'],
  ['vs19_707_037','2026-09-10'],
  ['vs19_704_039','2026-08-05'],
  ['vs19_703_080','2026-08-04']
];

async function fetchText(url, official) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 12000, maxRedirects: 0,
    maxContentLength: 2000000,
    validateStatus: status => status === 200,
    headers: { 'User-Agent': 'DEMOS/1.0 (public civic ballot source verification; https://demos.community)' }
  });
  const raw = Buffer.from(response.data);
  const type = String(response.headers['content-type'] || '').toLowerCase();
  const encoding = official && !type.includes('utf-8') ? 'windows-1252' : 'utf-8';
  return cheerio.load(new TextDecoder(encoding).decode(raw));
}

async function main() {
  for (const [id, expected] of cases) {
    const [seduta, number] = id.slice(5).split('_').map(Number);
    const url = 'https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?' +
      'CDDNATURA=FINALE&Legislatura=19&RifVotazione=' + seduta + '_' + number + '&tipo=dettaglio';
    try {
      const $ = await fetchText(url, true);
      const text = $('body').text().replace(/\s+/g,' ').trim();
      const dates = [...new Set((text.match(/\b\d{1,2}\/\d{1,2}\/20\d{2}\b/g) || []).slice(0,20))].slice(0,8);
      const isoDates = [...new Set((text.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || []).slice(0,20))].slice(0,8);
      console.log('OFFICIAL_BALLOT_DATE_DIAGNOSTIC',JSON.stringify({id,expected,dates,isoDates,hasExpected:text.includes(expected.slice(8,10)+'/'+expected.slice(5,7)+'/'+expected.slice(0,4))}));
    } catch (error) {
      console.log('OFFICIAL_BALLOT_DATE_DIAGNOSTIC',JSON.stringify({id,expected,source:'unavailable',reason:String(error.message).slice(0,70)}));
    }
  }

  try {
    const $ = await fetchText('https://parlamento19.openpolis.it/votazioni/19-463-35',false);
    const statuses = new Map(),invalid = [];
    $('table').each((_,tbl)=>{
      const rows=$(tbl).find('tr').toArray();
      const h=$(rows[0]).find('th,td').map((__,el)=>$(el).text().replace(/\s+/g,' ').trim().toLowerCase()).get();
      if(h[0]!=='senatore'||h[1]!=='voto'||h[2]!=='gruppo')return;
      for(const row of rows.slice(1)){
        const cells=$(row).find('td').toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim());
        if(cells.length<3)continue;
        statuses.set(cells[1],(statuses.get(cells[1])||0)+1);
        if(!cells[0]||cells[0].length<4||cells[0].length>150||!cells[2]||cells[2].length>90) invalid.push('row-shape');
      }
    });
    console.log('SENATE_STATUS_DIAGNOSTIC',JSON.stringify({id:'19-463-35',statuses:[...statuses],invalidShapes:invalid.length}));
  } catch(error){
    console.log('SENATE_STATUS_DIAGNOSTIC',JSON.stringify({id:'19-463-35',reason:String(error.message).slice(0,70)}));
  }
}
main().catch(error=>{console.error('BALLOT_DIAGNOSTIC_FAILED',error.message);process.exitCode=1;});
