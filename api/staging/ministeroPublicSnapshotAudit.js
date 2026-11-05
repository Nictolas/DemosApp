'use strict';

// Public data only. No database, env secrets, Firebase, routes or schedulers.
// Intended for an isolated staging PR GitHub Action to audit the Italian
// Ministry's live feed when the authorized PC is unavailable.
const {inspectMinisteroPage}=require('../services/ministeroPaginationSafety');
const OFFICIAL_URL='https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public';

function normalizeRecord(item) {
  const id=String(item?.id??'').trim();
  if (!/^[0-9]{1,14}$/.test(id)) throw new Error('MINISTERO_SOURCE_ID_INVALID');
  const title=String(item.titolo??item.nome??item.denominazione??item.oggetto??'').trim();
  if (!title || title.length>2000) throw new Error('MINISTERO_SOURCE_TITLE_INVALID');
  const rawType=String(item?.idDecTipoIniziativa?.nome??item.tipo??'').trim()
    .replace(/\s+/g,' ').toLowerCase();
  let type,category,path;
  if (rawType.startsWith('legge di iniziativa popolare')) {
    type='Legge di iniziativa popolare';
    category='iniziative_popolari';path='/iniziative-popolari';
  } else if (rawType.startsWith('referendum abrogativo')) {
    type='Referendum abrogativo';
    category='referendum_abrogativi';path='/referendum-abrogativi';
  } else {
    throw new Error('MINISTERO_SOURCE_TYPE_UNSUPPORTED');
  }
  const rawState=String(item?.idDecStatoIniziativa?.nome??item.stato??'').trim()
    .replace(/\s+/g,' ').toUpperCase();
  const stateMap={
    'IN RACCOLTA FIRME':'in_corso',
    'CHIUSA':'conclusa',
    'MESSA A DISPOSIZIONE':'messa_a_disposizione',
    'MESSA A DISPOSIZIONE CAMERA':'alla_camera',
    'MESSA A DISPOSIZIONE SENATO':'al_senato',
    'ALLA CAMERA':'alla_camera',
    'AL SENATO':'al_senato',
  };
  const state=stateMap[rawState];
  if (!state) throw new Error('MINISTERO_SOURCE_STATE_UNSUPPORTED');
  const count=item.sostenitori??item.firme??item.firmeRaccolte??0;
  const countString=String(count).trim();
  if (!/^\d{1,15}$/.test(countString)) throw new Error('MINISTERO_SOURCE_SIGNATURES_INVALID');
  const signatures=Number(countString);
  if (!Number.isSafeInteger(signatures))throw new Error('MINISTERO_SOURCE_SIGNATURES_INVALID');
  const dates=[item.dataInizioRaccolta??item.dataInizio??null,
    item.dataFineRaccolta??item.dataFine??null];
  if(dates.some(d=>d!==null&&(typeof d!=='string'&&typeof d!=='number')||
    dates.some(d=>d!==null&&String(d).length>80))) {
    throw new Error('MINISTERO_SOURCE_DATE_UNSUPPORTED');
  }
  return {
    id:'ministero_'+id,id_ministero:id,titolo:title,tipo:type,stato:state,
    stato_ufficiale:rawState,firme_raccolte:signatures,
    data_inizio_raw:dates[0],data_fine_raw:dates[1],
    sito_web:'https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/'+id,
    categoria_notifica:category,target_path:path,
  };
}

function normalizePayload(payload){
  const inspected=inspectMinisteroPage(payload,{
    currentPage:0,pageSize:100,priorItems:0,expectedTotal:null});
  if(inspected.hasMore ||
      inspected.expectedTotal===null ||
      inspected.expectedTotal!==inspected.items.length ||
      inspected.items.length>100 ||
      inspected.items.length===0) {
    throw new Error('MINISTERO_SOURCE_NOT_COMPLETE_SINGLE_PAGE');
  }
  // Debug only public *enumerations*, never raw JSON rows or descriptions.
  // The official source can add state labels without changing HTTP schema.
  if(process.env.DEMOS_OFFICIAL_SOURCE_SCHEMA_DIAGNOSTICS==='true') {
    const states={},types={},dateTypes={};
    for(const x of inspected.items){
      const state=String(x?.idDecStatoIniziativa?.nome??'MISSING').trim().slice(0,90);
      const type=String(x?.idDecTipoIniziativa?.nome??'MISSING').trim().slice(0,90);
      const start=x?.dataInizioRaccolta;
      const finish=x?.dataFineRaccolta;
      states[state]=(states[state]||0)+1;
      types[type]=(types[type]||0)+1;
      const key=(start===null?'null':typeof start)+'|'+
        (finish===null?'null':typeof finish);
      dateTypes[key]=(dateTypes[key]||0)+1;
    }
    console.log('MINISTERO_PUBLIC_SOURCE_SCHEMA_V1='+JSON.stringify({
      total:inspected.items.length,states,types,dateTypes,
    }));
  }
  const rows=inspected.items.map(normalizeRecord);
  const ids=new Set(rows.map(x=>x.id_ministero));
  if(ids.size!==rows.length)throw new Error('MINISTERO_SOURCE_DUPLICATE_ID');
  return rows;
}

async function readOfficialSource(fetchImpl=fetch){
  const r=await fetchImpl(OFFICIAL_URL,{
    headers:{Accept:'application/json',
      'User-Agent':'DEMOS-Staging-Official-Source-Audit/1.0'},
    signal:AbortSignal.timeout(25000),
  });
  if(!r?.ok)throw new Error('MINISTERO_SOURCE_HTTP_UNAVAILABLE');
  if(!String(r.headers?.get?.('content-type')||'').toLowerCase().includes('json')) {
    throw new Error('MINISTERO_SOURCE_UNEXPECTED_CONTENT_TYPE');
  }
  return normalizePayload(await r.json());
}

if(require.main===module){
  if(process.argv.length!==3||process.argv[2]!=='--public-source-audit'){
    console.error('MINISTERO_SOURCE_PUBLIC_AUDIT_ONLY');
    process.exitCode=1;
  }else{
    readOfficialSource().then(rows=>{
      const categories={},states={};
      for(const x of rows){
        categories[x.categoria_notifica]=(categories[x.categoria_notifica]||0)+1;
        states[x.stato_ufficiale]=(states[x.stato_ufficiale]||0)+1;
      }
      console.log('MINISTERO_PUBLIC_AUDIT_META_V1='+JSON.stringify({
        total:rows.length,categories,states,
        stored:false,pushEnabled:false,
      }));
      // Only public, selected fields; never emit the raw response body,
      // signatures of individuals, server credentials or private IDs.
      for(const row of rows) console.log('MINISTERO_PUBLIC_AUDIT_ROW_V1='+JSON.stringify(row));
    }).catch(error=>{
      // Error detail is intentionally allowlisted. Do not expose response
      // bodies, endpoint redirects, credentials, DNS addresses or query text.
      const code=typeof error?.message==='string' &&
        /^MINISTERO_(?:SOURCE|PAGINATION)_[A-Z0-9_]+$/.test(error.message)
        ? error.message : 'MINISTERO_SOURCE_NETWORK_OR_PROVIDER_FAILURE';
      console.error('MINISTERO_PUBLIC_AUDIT_FAILED: '+code);
      process.exitCode=1;
    });
  }
}
module.exports={OFFICIAL_URL,normalizeRecord,normalizePayload,readOfficialSource};
