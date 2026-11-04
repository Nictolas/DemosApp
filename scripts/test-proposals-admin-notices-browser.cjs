'use strict';
// Localhost-only Chrome smoke. All auth, proposal and notification records are
// synthetic and intercepted; any non-local network request is blocked.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const ID='33333333-3333-4333-8333-333333333333';
const PROPOSAL='22222222-2222-4222-8222-222222222222';
const token=['eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({userId:ID,role:'AD',exp:4102444800})).toString('base64url'),
  'admin-synthetic-browser-only'].join('.');
function json(route,status,data){
  return route.fulfill({status,contentType:'application/json',
    body:JSON.stringify(data),headers:{'cache-control':'no-store'}});
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
      await context.addInitScript(value=>localStorage.setItem('auth_token',value),token);
      const page=await context.newPage();
      page.on('dialog',dialog=>dialog.accept());
      let auditReads=0,withdrawReads=0,decisionWrites=0;
      await page.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin!==BASE)return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        if(url.pathname==='/api/auth/me')return json(route,200,{success:true,user:{
          id:ID,is_admin:true,ruolo:'AD',status:'a',role:'AD',account_type:'P'}});
        if(url.pathname==='/api/subject-proposals/admin'){
          return json(route,200,{success:true,proposals:[{id:PROPOSAL,
            category:'organizzazioni',title:'Organizzazione sintetica di test',
            details:'',source_url:'https://example.org/fonte',created_at:'2026-11-04T09:00:00Z'}]});
        }
        if(url.pathname==='/api/subject-proposals/admin/withdraw-notifications'){
          withdrawReads++;return json(route,200,{success:true,withdrawals:[]});
        }
        if(url.pathname==='/api/subject-proposals/admin/notification-audit'){
          auditReads++;return json(route,200,{success:true,proposals:[{id:PROPOSAL,
            category:'organizzazioni',status:'rejected',created_at:'2026-11-04T09:00:00Z',
            reviewed_at:'2026-11-04T10:00:00Z',submission_notification_sent:false,
            review_notification_sent:false}]});
        }
        if(url.pathname==='/api/subject-proposals/admin/'+PROPOSAL+'/decision' &&
           request.method()==='POST'){
          decisionWrites++;
          assert.equal(request.postDataJSON().decision,'reject');
          return json(route,200,{success:true,status:'rejected',notification_sent:false});
        }
        if(request.method()!=='GET')return json(route,403,{success:false});
        return json(route,200,{success:true,data:[]});
      });
      await page.goto(BASE+'/gestisci/proposte-soggetti',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Proposte di nuovi soggetti'}).waitFor({timeout:25000});
      assert.equal(auditReads,0,'no private audit GET on page mount');
      assert.equal(withdrawReads,0,'no withdrawal GET on page mount');
      await page.getByRole('button',{name:'Rifiuta'}).click();
      // The current toast system renders a visible toast and an accessible live
      // announcement. Either copy indicates the same success notification.
      await page.getByText('Esito registrato, ma notifica non confermata.',{exact:false})
        .first().waitFor({timeout:15000});
      assert.equal(decisionWrites,1);
      await page.getByRole('button',{name:'Avvisi da verificare'}).click();
      await page.getByText('Avviso iniziale non confermato.',{exact:false})
        .waitFor({timeout:15000});
      await page.getByText('Comunicazione dell\'esito non confermata.',{exact:false})
        .waitFor({timeout:15000});
      assert.equal(auditReads,1,'only explicit Admin click fetches personal notification audit');
      assert.equal(withdrawReads,1);
      assert.ok((await page.locator('body').textContent()).includes(PROPOSAL));
      const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,screen:innerWidth}));
      assert.ok(metrics.width<=metrics.screen+2,'horizontal overflow '+JSON.stringify(metrics));
      await context.close();
      console.log('ADMIN NOTIFICATION AUDIT browser PASS '+viewport.width+'x'+viewport.height);
    }
  }finally{await browser.close();}
})().catch(err=>{console.error(err.stack||err.message);process.exitCode=1;});
