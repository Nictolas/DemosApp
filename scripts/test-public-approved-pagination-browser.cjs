'use strict';
// Browser only: synthetic API fixtures for >100 approved subjects in each category.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'demos12-public-pagination-only'].join('.');
const entries=category=>Array.from({length:105},(_,i)=>({
 id:(category==='attivisti'?'90000000':'a0000000')+'-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 title:'Soggetto sintetico '+(i+1)
}));
function reply(route,data,status=200){
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),
 headers:{'cache-control':'no-store'}});
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const category of ['attivisti','organizzazioni']){
   for(const viewport of [{width:320,height:568},{width:390,height:844}]){
    const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
    await ctx.addInitScript(t=>localStorage.setItem('auth_token',t),TOKEN);
    const page=await ctx.newPage(),reads=[],firstReads=[],rows=entries(category);
    await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(!url.pathname.startsWith('/api/'))
       return url.origin===BASE?route.continue():route.abort();
     if(route.request().method()!=='GET')
       return reply(route,{success:false,error:'Synthetic mutation forbidden'},403);
     if(url.pathname==='/api/auth/me')
       return reply(route,{success:true,user:{id:ID,account_type:'E',status:'a',role:'E',ruolo:'E',
          political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
     if(url.pathname==='/api/'+category){
       firstReads.push(url.toString());
       return reply(route,{success:true,data:[],approved_subjects:rows.slice(0,100),
          approved_next_cursor:'synthetic-next'});
     }
     if(url.pathname==='/api/subject-proposals/approved'){
      reads.push(url.toString());
      if(url.searchParams.get('category')!==category ||
         url.searchParams.get('cursor')!=='synthetic-next')
         return reply(route,{success:false,error:'Wrong synthetic page'},400);
      return reply(route,{success:true,data:rows.slice(100),next_cursor:null});
     }
     if(url.pathname==='/api/'+category+'/filtri')
       return reply(route,{success:true,data:{regioni:[],tipologie:[]}});
     return reply(route,{success:true,data:[]});
    });
    await page.goto(BASE+'/'+category,{waitUntil:'domcontentloaded'});
    await page.getByText('Soggetto sintetico 100',{exact:true}).waitFor({timeout:20000});
    assert.equal(firstReads.length,1,'initial directory GET only');
    assert.equal(reads.length,0,'never auto-fetch page two');
    const label=category==='attivisti'?'Carica altri attivisti approvati':
       'Carica altre organizzazioni approvate';
    const more=page.getByRole('button',{name:label});
    await more.waitFor({timeout:15000});
    await more.click();
    await page.getByText('Soggetto sintetico 105',{exact:true}).waitFor({timeout:15000});
    assert.equal(reads.length,1,'one on-demand page');
    assert.equal(await page.getByText('Soggetto sintetico 1',{exact:true}).count(),1);
    assert.equal(await more.count(),0,'no more pages');
    const title=category==='attivisti'?'Attivisti segnalati e approvati':
      'Organizzazioni segnalate e approvate';
    assert.equal(await page.locator('[aria-label="'+title+'"] .grid > *').count(),105);
    const layout=await page.evaluate(()=>({w:innerWidth,s:document.documentElement.scrollWidth}));
    assert.ok(layout.s<=layout.w+2,'no horizontal mobile overflow');
    await ctx.close();
    console.log('PUBLIC PAGINATION CHROME PASS '+category+' '+viewport.width+'x'+viewport.height);
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});