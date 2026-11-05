'use strict';
// Chrome-only mock API smoke: real mounted directories, 105 synthetic profiles.
// No real user accounts, external requests, database connections or writes.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE=process.env.D12_QA_BASE_URL||'http://localhost:4173';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'd12-public-registered-directory-pagination'].join('.');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const member=i=>({
 id:uuid(i),nome:'Profilo sintetico '+i,cognome:'Finto',ruolo:'A',
 avatar_config:null,regione_residenza:'TO',tipologie_attivismo:[],supporters_count:0
});
const members=Array.from({length:105},(_,i)=>member(i+1));
const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',
 headers:{'cache-control':'no-store'},body:JSON.stringify(data)});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const category of ['attivisti','organizzazioni']){
   for(const viewport of [{width:320,height:568},{width:390,height:844}]){
    const ctx=await browser.newContext({viewport,serviceWorkers:'block'});
    await ctx.addInitScript(t=>localStorage.setItem('auth_token',t),TOKEN);
    const page=await ctx.newPage();
    const reads={first:0,more:0,filter:0,approved:0,external:0};
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.origin!==BASE){reads.external++;return route.abort();}
      if(!u.pathname.startsWith('/api/'))return route.continue();
      if(route.request().method()!=='GET')
        return reply(route,{success:false,error:'Synthetic mutation forbidden'},403);
      if(u.pathname==='/api/auth/me')
        return reply(route,{success:true,user:{id:ID,account_type:'E',status:'a',ruolo:'E',
          political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
      if(u.pathname==='/api/'+category+'/filtri')
        return reply(route,{success:true,data:{regioni:[],tipologie:[]}});
      if(u.pathname==='/api/subject-proposals/approved'){
        reads.approved++;
        return reply(route,{success:false},400);
      }
      if(u.pathname==='/api/'+category){
        assert.equal(u.searchParams.get('members_paged'),'1',
          'updated clients must explicitly opt in to 100-profile pages');
        if(u.searchParams.get('search')==='zzzz-no-match'){
          reads.filter++;
          return reply(route,{success:true,data:[],count:0,members_next_cursor:null,
              approved_subjects:[],approved_next_cursor:null});
        }
        if(u.searchParams.get('members_cursor')){
          assert.equal(u.searchParams.get('members_cursor'),'member-next');
          reads.more++;
          return reply(route,{success:true,data:members.slice(100),count:5,
            members_next_cursor:null,approved_subjects:[],approved_next_cursor:null});
        }
        reads.first++;
        return reply(route,{success:true,data:members.slice(0,100),count:100,
          members_next_cursor:'member-next',
          approved_subjects:[{id:'approved-only-fixture',title:'Nomina verificata sintetica'}],
          approved_next_cursor:null});
      }
      return reply(route,{success:true,data:[]});
    });
    await page.goto(BASE+'/'+category,{waitUntil:'domcontentloaded'});
    const moreText=category==='attivisti'
      ?'Carica altri attivisti registrati':'Carica altre organizzazioni registrate';
    const button=page.getByRole('button',{name:moreText});
    await button.waitFor({timeout:20000});
    assert.equal(reads.first,1);
    assert.equal(reads.more,0,'no implicit next-page request');
    await button.click();
    await page.locator('button:visible').filter({hasText:'Profilo sintetico 105'}).first().waitFor({timeout:16000});
    assert.equal(reads.more,1,'only one requested registered next page');
    assert.equal(await page.getByRole('button',{name:moreText}).count(),0);
    assert.ok(await page.getByText('Nomina verificata sintetica').count()>0,
      'registered-profile paging must not replace approved nominations');
    const box=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(box.scroll<=box.width+2,'horizontal overflow '+JSON.stringify(box));
    await page.getByPlaceholder('Cerca per nome o cognome...').fill('zzzz-no-match');
    await page.waitForResponse(response=>response.url().includes('search=zzzz-no-match'),{timeout:12000});
    await page.waitForFunction(()=>!document.body.textContent.includes('Profilo sintetico 105'),null,{timeout:15000});
    assert.equal(reads.filter,1);
    assert.equal(reads.more,1,'filter change must not reuse the previous cursor');
    assert.equal(reads.approved,0,'no independent approved-directory reads');
    assert.equal(reads.external,0,'never contact a real external service');
    await ctx.close();
    console.log('D12_REGISTERED_CHROME_PASS '+JSON.stringify({category,viewport,reads,box}));
   }
  }
 }finally{await browser.close()}
})().catch(e=>{console.error('D12_REGISTERED_CHROME_FAIL '+(e.stack||e.message));process.exitCode=1});
