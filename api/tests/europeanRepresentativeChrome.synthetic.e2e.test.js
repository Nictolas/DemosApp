'use strict';

// Real installed Google Chrome + actual Vite/React representative dialog.
// Synthetic token, synthetic official vote payloads, no production requests,
// no personal data and no database credentials. This is UI QA, not release E2E.
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const browserModule=process.env.DEMOS_PLAYWRIGHT_MODULE;
const origin='http://localhost:3000';
const userId='00000000-0000-4000-8000-000000000101';
const repId='00000000-0000-4000-8000-000000000102';
const name='QA Eurodeputata';
const official='https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-10-22/decisions';
const longSubject=('Risoluzione finale sul testo nel suo insieme, '+ 
  'contenuto verificato da decisione ufficiale, ').repeat(18);

async function ready(url) {
  const deadline=Date.now()+45000;
  while(Date.now()<deadline) {
    try {
      const res=await fetch(url,{signal:AbortSignal.timeout(1200)});
      if(res.ok)return;
    }catch {/* wait for local Vite only */}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw new Error('EP_CHROME_VITE_NOT_READY');
}
const verifiedVote=Object.freeze({
  verified:true,mepId:'256900',voteId:'MTG-PL-2026-10-22-DEC-199517',
  subject:longSubject,date:'2026-10-22',vote:'Favorevole',outcome:'Approvato',
  sourceUrl:official
});
const account={
  id:userId,nome:'QA',cognome:'Demo',role:'E',ruolo:'E',status:'a',
  paese_residenza:'IT',provincia_residenza:'PI',
  political_consent:{granted:true,timestamp:'2026-11-08T00:00:00Z'}
};

test('Chrome 320/390: real European representative card, one verified vote and fail-closed fallback', {
  skip:!browserModule,timeout:190000
},async()=>{
  for(const k of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','PGHOST','PGDATABASE'])
    assert.equal(process.env[k],undefined,'No production DB credentials: '+k);
  const {chromium}=require(browserModule);
  let vite,browser;
  try{
    vite=spawn(process.execPath,[
      path.join(root,'client/node_modules/vite/bin/vite.js'),
      '--config','vite.config.js','--host','localhost','--port','3000','--strictPort'
    ],{cwd:path.join(root,'client'),env:{
      ...process.env,NODE_ENV:'development',VITE_API_BASE_URL:'',VITE_API_URL:''
    },stdio:['ignore','pipe','pipe']});
    let err='';
    vite.stderr.on('data',chunk=>{err+=String(chunk).slice(0,2000);});
    await ready(origin+'/');
    browser=await chromium.launch({
      channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
    });
    let cases=0;
    for(const screen of [{width:320,height:568},{width:390,height:844}]){
      for(const full of [true,false]){
        const context=await browser.newContext({
          viewport:screen,hasTouch:screen.width===320,
          serviceWorkers:'block',permissions:[]
        });
        const payload=Buffer.from(JSON.stringify({
          userId,role:'E',status:'a',exp:Math.floor(Date.now()/1000)+3600
        })).toString('base64');
        const token='eyJhbGciOiJIUzI1NiJ9.'+payload+'.qa-local-only-unsigned';
        await context.addInitScript(t=>localStorage.setItem('auth_token',t),token);
        const page=await context.newPage();
        let external=0,authenticated=0;
        await page.route('**/*',async route=>{
          const req=route.request(),url=new URL(req.url());
          if(url.origin!==origin){external++;return route.abort('blockedbyclient');}
          if(!url.pathname.startsWith('/api/'))return route.continue();
          const reply=(data,status=200)=>route.fulfill({
            status,contentType:'application/json; charset=utf-8',
            headers:{'cache-control':'no-store'},body:JSON.stringify(data)
          });
          if(req.headers()['authorization']!=='Bearer '+token)
            return reply({success:false,error:'QA_TOKEN_REQUIRED'},401);
          authenticated++;
          if(url.pathname==='/api/auth/me'||url.pathname==='/api/users/me')
            return reply({success:true,user:account});
          if(url.pathname==='/api/rappresentanti')
            return reply({success:true,data:{
              rappresentanti:{europeo:[{
                id:repId,nome:'QA',cognome:'Eurodeputata',
                ruolo:'E',status:'a',avatar_config:null,
                ultimo_voto_nominale:full?verifiedVote:null
              }]},idMap:{[repId]:name}
            }});
          if(/^\/api\/users\/[^/]+\/opinioni$/.test(url.pathname))
            return reply({success:true,data:{opinioni:[],fonti:{}}});
          if(url.pathname==='/api/user/political-opinions-consent')
            return reply({success:true,consent:account.political_consent});
          return reply({success:true,data:{opinioni:[],fonti:{}}});
        });
        try{
          await page.goto(origin+'/rappresentanti',{waitUntil:'domcontentloaded'});
          const rep=page.getByText(name,{exact:true}).first();
          await rep.waitFor({timeout:30000});
          if(screen.width===320) await rep.tap();
          else await rep.click();
          const card=page.locator('[aria-label="Ultimo voto del Parlamento europeo"]');
          await card.waitFor({timeout:15000});
          assert.ok(await card.isVisible(),'Current EU vote section must be visible');
          // The outer representative tile used to schedule a navigation on
          // mouseup/touchend BEFORE the inner name's click could stop it.
          // Wait longer than that historical 100-ms timer; staying on the
          // page proves there is no delayed redirect that hides the dialog.
          await page.waitForTimeout(180);
          assert.equal(new URL(page.url()).pathname,'/rappresentanti',
            'Tap/click on the MEP name must not navigate to chooser');
          const frame=await card.boundingBox();
          assert.ok(frame&&frame.height<=screen.height*0.35+8,
            'Long subject must fit viewport '+screen.width+'x'+screen.height);
          assert.ok(authenticated>0,'All synthetic API calls require auth header');
          if(full){
            await card.getByText('Data: 2026-10-22',{exact:true}).waitFor();
            assert.ok(await card.getByText('Voto: Favorevole',{exact:true}).isVisible());
            assert.ok(await card.getByText('Esito: Approvato',{exact:true}).isVisible());
            assert.equal(await card.locator('a[href="'+official+'"]').count(),1);
            assert.equal(await card.getByText('Voto individuale non ancora verificabile').count(),0);
          }else{
            assert.ok(await card.getByText(/Voto individuale non ancora verificabile/).isVisible());
            assert.equal(await card.locator('a').count(),0);
            assert.equal(await card.getByText('Voto: Favorevole').count(),0);
          }
          assert.equal(await card.getByText(/gruppo politico|partito/i).count(),0);
          assert.equal(external,0,'No requests to hosted staging or production');
          cases++;
        }finally{await context.close();}
      }
    }
    assert.equal(cases,4);
    console.log('EP_CHROME_320_390_SYNTHETIC_PASS',JSON.stringify({
      cases,realInstalledChrome:true,dimensions:['320x568','390x844'],
      verifiedOrNull:['verified','not-verified'],hostedRequests:0,
      realAccountRequests:0,persistenceWrites:0
    }));
  }finally{
    if(browser)await browser.close();
    if(vite){
      vite.kill('SIGTERM');
      await new Promise(resolve=>{
        if(vite.exitCode!==null)return resolve();
        vite.once('exit',resolve);
        setTimeout(resolve,3000).unref();
      });
    }
  }
});
