'use strict';
// Requires a LOCAL Vite dev server on http://localhost:4180; never uses live accounts.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4180';
const OWNER_A='00000000-0000-4000-8000-000000001111';
const OWNER_B='00000000-0000-4000-8000-000000002222';
const TOKEN=['eyJhbGciOiJub25lIn0',Buffer.from(JSON.stringify({
  userId:OWNER_A,role:'E',exp:4102444800
})).toString('base64url'),'synthetic-owner-test'].join('.');
function ok(route,data,status=200){
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),
    headers:{'cache-control':'private, no-store'}});
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
      await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
      const page=await context.newPage();
      let statusReads=0, resolveOld, startedOld;
      const oldStarted=new Promise(resolve=>{startedOld=resolve;});
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==BASE)return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        if(url.pathname==='/api/auth/me')return ok(route,{success:true,user:{
          id:OWNER_A,email:'',status:'a',ruolo:'E',role:'E',account_type:'E',
          political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
        if(url.pathname==='/api/subject-proposals/mine' && route.request().method()==='GET'){
          statusReads++;
          if(statusReads===1)return new Promise((resolve,reject)=>{
            resolveOld=()=>ok(route,{success:true,latest:{id:'old-a',status:'approved'}}).then(resolve,reject);
            startedOld();
          });
          return ok(route,{success:true,latest:{id:'new-b',status:'rejected'}});
        }
        return ok(route,{success:true,data:[]});
      });
      await page.goto(BASE+'/proponi-soggetto?categoria=organizzazioni',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Proponi',exact:true}).waitFor({timeout:20000});
      assert.equal(statusReads,0,'personal GET must be on demand only');
      await page.getByRole('button',{name:'Verifica stato della mia proposta'}).click();
      await oldStarted;
      // Change only the synthetic user query cache, preserving the mounted page,
      // as if the global authentication provider had switched account identity.
      await page.evaluate(async ({token,nextId})=>{
        const {queryClient}=await import('/src/lib/queryClient.ts');
        queryClient.setQueryData(['user',token],{id:nextId,email:'',status:'a',ruolo:'E',
          role:'E',account_type:'E',political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}});
      },{token:TOKEN,nextId:OWNER_B});
      await page.getByRole('button',{name:'Verifica stato della mia proposta'}).waitFor({state:'visible'});
      await page.waitForFunction(()=>!document.querySelector('button')?.disabled,{timeout:10000});
      assert.equal(await page.getByText('La proposta è stata approvata.').count(),0);
      resolveOld();
      await page.waitForTimeout(80);
      assert.equal(await page.getByText('La proposta è stata approvata.').count(),0,
        'late old-account response must not leak to another user');
      assert.equal(statusReads,1,'account switch must not trigger personal GET');
      const button=page.getByRole('button',{name:'Verifica stato della mia proposta'});
      await button.click();
      await page.getByText('La proposta non è stata approvata.').waitFor({timeout:15000});
      assert.equal(statusReads,2,'new account reads only on click');
      const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
      assert.ok(width.scroll<=width.view+2,'no horizontal overflow');
      await context.close();
      console.log('PROPOSAL OWNER PRIVACY browser PASS '+viewport.width+'x'+viewport.height);
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
