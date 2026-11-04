'use strict';
// DEMOS12: two private Admin audit lists, synthetic identity, localhost Chrome only.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'demos12-audit-chrome-only'].join('.');
const SIZES=[{width:320,height:568},{width:390,height:844}];
const withdrawals=Array.from({length:105},(_,i)=>({
 id:'50000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 category:'organizzazioni',withdrawn_at:'2026-11-05T00:00:00.000Z',
 recipient_unavailable:i%2===0
}));
const proposals=Array.from({length:105},(_,i)=>({
 id:'60000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 category:'attivisti',status:'rejected',
 created_at:'2026-11-05T00:00:00.000Z',reviewed_at:null,
 submission_notification_sent:false,review_notification_sent:false,
 recipient_unavailable:i%2===1
}));
function reply(route,body,status=200){
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),
 headers:{'cache-control':'private, no-store'}});
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
 try{
  for(const viewport of SIZES){
   const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
   const page=await ctx.newPage();
   const reads={withdrawals:[],proposals:[]};
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==BASE)return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    if(route.request().method()!=='GET')
      return reply(route,{success:false,error:'Synthetic mutation forbidden'},403);
    if(url.pathname==='/api/auth/me')
      return reply(route,{success:true,user:{
       id:ID,is_admin:true,account_type:'E',status:'a',role:'E',ruolo:'E',
       political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}
      }});
    if(url.pathname==='/api/subject-proposals/admin')
      return reply(route,{success:true,proposals:[],next_cursor:null});
    for(const [suffix,key,rows] of [
      ['/withdraw-notifications','withdrawals',withdrawals],
      ['/notification-audit','proposals',proposals]
    ]){
      if(url.pathname==='/api/subject-proposals/admin'+suffix){
        reads[key].push(url.toString());
        const cursor=url.searchParams.get('cursor');
        if(cursor==='next-'+key)
          return reply(route,{success:true,[key]:rows.slice(100),next_cursor:null});
        if(cursor)return reply(route,{success:false,error:'Unexpected cursor'},400);
        return reply(route,{success:true,[key]:rows.slice(0,100),next_cursor:'next-'+key});
      }
    }
    return reply(route,{success:true,data:[]});
   });
   await page.goto(BASE+'/gestisci/proposte-soggetti',{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Proposte di nuovi soggetti'}).waitFor({timeout:20000});
   assert.equal(reads.withdrawals.length+reads.proposals.length,0,
     'no audit read is allowed on Admin page mount');
   await page.getByRole('button',{name:'Avvisi da verificare'}).click();
   await page.getByRole('button',{name:'Carica altri avvisi da verificare'}).waitFor({timeout:20000});
   assert.equal(reads.withdrawals.length,1);
   assert.equal(reads.proposals.length,1);
   await page.getByRole('button',{name:'Carica altri avvisi da verificare'}).click();
   await page.waitForFunction(()=>document.querySelectorAll('article').length===210,{timeout:20000});
   assert.equal(reads.withdrawals.length,2,'second withdrawal audit page requires click');
   assert.equal(reads.proposals.length,2,'second notice audit page requires click');
   assert.equal(await page.getByRole('button',{name:'Carica altri avvisi da verificare'}).count(),0);
   assert.equal(await page.locator('article').count(),210,'both private audits remain accessible');
   assert.equal(await page.locator('article').first().getByText(/Destinatario assente o non attivo/).count(),1);
   const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
   assert.ok(metrics.scroll<=metrics.view+2,'no horizontal overflow on mobile');
   await ctx.close();
   console.log('ADMIN AUDIT PAGINATION CHROME PASS '+viewport.width+'x'+viewport.height);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
