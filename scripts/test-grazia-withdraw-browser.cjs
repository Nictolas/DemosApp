'use strict';
// Browser smoke: ONLY localhost, only synthetic accounts and intercepted APIs.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const ADMIN='33333333-3333-4333-8333-333333333333';
const REQUEST='44444444-4444-4444-8444-444444444444';
const TOKEN=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({
  userId:ADMIN,role:'AD',exp:4102444800
})).toString('base64url'),'synthetic-grazia-admin-only'].join('.');
function reply(route,data,status=200){
  return route.fulfill({status,body:JSON.stringify(data),contentType:'application/json',
    headers:{'cache-control':'private,no-store'}});
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
      await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
      const page=await context.newPage();
      page.on('dialog',d=>d.accept());
      let approvedReads=0,auditReads=0,retireWrites=0;
      await page.route('**/*',route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin!==BASE)return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        if(url.pathname==='/api/auth/me')return reply(route,{success:true,user:{
          id:ADMIN,is_admin:true,ruolo:'AD',status:'a',role:'AD',account_type:'P'}});
        if(url.pathname==='/api/grazia/richieste')return reply(route,[]);
        if(url.pathname==='/api/grazia/approvate'){
          approvedReads++;
          return reply(route,{success:true,richieste:retireWrites?[]:[
            {id:REQUEST,nome:'Persona sintetica Grazia',createdAt:'2026-11-04T09:00:00Z'}]});
        }
        if(url.pathname==='/api/grazia/ritiri-avvisi'){
          auditReads++;
          return reply(route,{success:true,ritiri:[{id:REQUEST,withdrawn_at:'2026-11-04T12:00:00Z'}]});
        }
        if(url.pathname==='/api/grazia/richiesta/'+REQUEST+'/ritira' && request.method()==='POST'){
          assert.equal(request.postDataJSON().note,'Ritiro sintetico verificabile');
          retireWrites++;
          return reply(route,{success:true,status:'withdrawn',notification_sent:false});
        }
        return reply(route,{success:true,data:[]});
      });
      await page.goto(BASE+'/gestisci-grazia',{waitUntil:'domcontentloaded'});
      await page.getByText('Proposte Grazia da valutare').first().waitFor({timeout:25000});
      assert.equal(approvedReads,0,'no approved private GET on page load');
      assert.equal(auditReads,0,'no notice audit on page load');
      await page.getByRole('button',{name:'Verifica proposte Grazia pubblicate'}).click();
      await page.getByText('Persona sintetica Grazia').waitFor({timeout:15000});
      assert.equal(approvedReads,1);
      await page.getByRole('textbox',{name:'Motivazione del ritiro Grazia di Persona sintetica Grazia'})
        .fill('Ritiro sintetico verificabile');
      await page.getByRole('button',{name:'Ritira pubblicazione Grazia'}).click();
      await page.getByText('Persona sintetica Grazia').waitFor({state:'detached',timeout:15000});
      assert.equal(retireWrites,1);
      await page.getByRole('button',{name:'Verifica avvisi di ritiro'}).click();
      await page.getByText('Riferimento ritiro:',{exact:false}).waitFor({timeout:15000});
      assert.equal(auditReads,1,'audit fetched only on user click');
      const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
      assert.ok(metrics.width<=metrics.viewport+2,'horizontal overflow '+JSON.stringify(metrics));
      await context.close();
      console.log('GRAZIA WITHDRAW browser PASS '+viewport.width+'x'+viewport.height);
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
