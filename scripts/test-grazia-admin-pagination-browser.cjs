'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.D12_QA_BASE_URL || 'http://localhost:4173';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=[
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({userId:ID,exp:4102444800,role:'AD'})).toString('base64url'),
  'd12-pagination-synthetic-only',
].join('.');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const json=(route,data,status=200)=>route.fulfill({
  status,contentType:'application/json',headers:{'cache-control':'private, no-store'},
  body:JSON.stringify(data),
});
async function run(){
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try {
    const width=Number(process.env.D12_QA_WIDTH || 390);
    const context=await browser.newContext({viewport:{width,height:width===320?568:844},serviceWorkers:'block'});
    await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
    const page=await context.newPage();
    const counts={pending:0,approved:0,audit:0,external:0,other:0};
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.origin!==BASE){counts.external++;return route.abort();}
      if(!u.pathname.startsWith('/api/'))return route.continue();
      if(u.pathname==='/api/auth/me')return json(route,{
        success:true,user:{id:ID,is_admin:true,isAdmin:true,role:'AD',ruolo:'AD',status:'a',
          account_type:'P',political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}
      });
      if(route.request().method()==='POST' &&
         /^\/api\/grazia\/richiesta\/[0-9a-f-]+\/(?:accetta|rifiuta|ritira)$/.test(u.pathname)){
        counts.other++;
        const withdrawal=u.pathname.endsWith('/ritira');
        return json(route,{success:true,status:withdrawal?'withdrawn':'approved',notification_sent:false});
      }
      const typ=u.pathname==='/api/grazia/richieste'?'pending':
        u.pathname==='/api/grazia/approvate'?'approved':
        u.pathname==='/api/grazia/ritiri-avvisi'?'audit':null;
      if(typ){
        counts[typ]++;
        const isNext=u.searchParams.get('cursor')==='NEXT';
        if(typ==='pending') assert.equal(u.searchParams.get('paged'),'1');
        const n=isNext?5:100;
        const start=isNext?101:1;
        const items=Array.from({length:n},(_,j)=>{
          const i=start+j;
          return typ==='audit'?{id:uuid(i),withdrawn_at:'2026-11-05T13:00:00Z'}:
            {id:uuid(i),nome:(typ==='pending'?'Candidato':'Approvato')+' sintetico '+i,
              ...(typ==='pending'?{urlProva:'https://example.org/fonte'}:{}),
              createdAt:'2026-11-05T13:00:00Z'};
        });
        return json(route,{success:true,[typ==='audit'?'ritiri':'richieste']:items,next_cursor:isNext?null:'NEXT'});
      }
      counts.other++;
      if(route.request().method()!=='GET')return json(route,{success:false},403);
      return json(route,{success:true,data:[]});
    });
    await page.goto(BASE+'/gestisci-grazia',{waitUntil:'domcontentloaded'});
    await page.getByText('Proposte Grazia da valutare').waitFor({timeout:15000});
    await page.getByText('Candidato sintetico 100',{exact:true}).waitFor({timeout:15000});
    assert.equal(counts.pending,1);
    assert.equal(counts.approved,0);
    assert.equal(counts.audit,0);
    await page.getByRole('button',{name:'Carica altre proposte da valutare'}).click();
    await page.getByText('Candidato sintetico 105',{exact:true}).waitFor({timeout:10000});
    assert.equal(counts.pending,2);
    await page.getByRole('button',{name:'Verifica proposte Grazia pubblicate'}).click();
    await page.getByText('Approvato sintetico 100',{exact:true}).waitFor({timeout:10000});
    assert.equal(counts.approved,1);
    assert.equal(counts.audit,0);
    await page.getByRole('button',{name:'Carica altre pubblicazioni Grazia'}).click();
    await page.getByText('Approvato sintetico 105',{exact:true}).waitFor({timeout:10000});
    assert.equal(counts.approved,2);
    await page.getByRole('button',{name:'Verifica avvisi di ritiro'}).click();
    await page.getByText('Riferimento ritiro: '+uuid(100),{exact:true}).waitFor({timeout:10000});
    assert.equal(counts.audit,1);
    await page.getByRole('button',{name:'Carica altri avvisi di ritiro'}).click();
    await page.getByText('Riferimento ritiro: '+uuid(105),{exact:true}).waitFor({timeout:10000});
    assert.equal(counts.audit,2);

    // An approval of a record on page 2 must reset all loaded infinite
    // queries to page one, not automatically re-query the older pages.
    const record105=page.getByText('Candidato sintetico 105',{exact:true});
    await record105.locator('..').getByRole('button',{name:'Approva'}).click();
    await record105.waitFor({state:'detached',timeout:10000});
    await page.getByText('Candidato sintetico 100',{exact:true}).waitFor({timeout:10000});
    await page.waitForTimeout(300);
    assert.equal(counts.pending,3,'approval must perform exactly one pending page refetch');
    assert.equal(counts.approved,3,'approval must perform exactly one approved page refetch');
    assert.equal(counts.audit,2,'unrelated audit must remain untouched');

    const item1=page.getByText('Approvato sintetico 1',{exact:true}).locator('..');
    await item1.getByRole('textbox').fill('Ritiro sintetico con causale neutra');
    page.once('dialog',dialog=>dialog.accept());
    await item1.getByRole('button',{name:'Ritira pubblicazione Grazia'}).click();
    await page.getByText('Approvato sintetico 100',{exact:true}).waitFor({timeout:10000});
    await page.waitForTimeout(300);
    assert.equal(counts.pending,3,'withdrawal must not re-query pending nominations');
    assert.equal(counts.approved,4,'withdrawal must re-fetch only the first approved page');
    assert.equal(counts.audit,3,'withdrawal must re-fetch only the first audit page');

    const box=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(box.scroll<=box.width+2,'horizontal overflow: '+JSON.stringify(box));
    assert.equal(counts.external,0,'no real external server contacted');
    await context.close();
    console.log('D12_GRAZIA_CHROME_PAGINATION_PASS '+JSON.stringify({counts,box}));
  }finally{await browser.close()}
}
run().catch(e=>{console.error('D12_GRAZIA_CHROME_PAGINATION_FAIL '+(e.stack||e.message));process.exitCode=1});
