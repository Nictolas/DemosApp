'use strict';
// Chrome mobile verification: synthetic Grazia catalog, zero external network or real users.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const USER='56565656-5656-4565-8565-565656565656';
const TOKEN=['eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({userId:USER,role:'E',exp:4102444800})).toString('base64url'),
  'synthetic-grazia-contact'].join('.');
const privateFailure='SYNTHETIC_SQL_DETAILS_private_voting_personal_name';
const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',
  body:JSON.stringify(data),headers:{'cache-control':'private, no-store'}});

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try{
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      for(const scenario of ['empty','populated','api-failure']){
        const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
        await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
        const page=await context.newPage();
        const consoleEntries=[];
        const personalReads=[];
        const externalRequests=[];
        page.on('console',message=>consoleEntries.push(message.text()));
        await page.route('**/*',route=>{
          const request=route.request();
          const url=new URL(request.url());
          if(url.origin!==BASE){externalRequests.push(url.origin);return route.abort();}
          if(!url.pathname.startsWith('/api/'))return route.continue();
          if(request.method()!=='GET')return reply(route,{success:false,error:'Synthetic write disabled'},403);
          if(url.pathname==='/api/auth/me'){
            return reply(route,{success:true,user:{id:USER,account_type:'E',status:'a',
              role:'E',ruolo:'E',political_consent:{granted:true,timestamp:'2026-11-01T00:00:00Z'}}});
          }
          if(url.pathname==='/api/grazia'){
            personalReads.push(url.toString());
            if(scenario==='api-failure')return reply(route,{success:false,error:privateFailure},503);
            return reply(route,{success:true,classifica:scenario==='populated'?
              [{nome:'Persona pubblica sintetica',richieste:3}]:[],
              mieiVoti:[],blocco:{isBlocked:false,unlockDate:null}});
          }
          return reply(route,{success:true,data:[]});
        });
        await page.goto(BASE+'/grazia',{waitUntil:'domcontentloaded'});
        const contact=page.locator('a[href="mailto:privacy@demos.community"]');
        await contact.waitFor({timeout:25000});
        assert.equal(await contact.count(),1,'one privacy contact per scenario');
        assert.equal(await contact.getAttribute('href'),'mailto:privacy@demos.community');
        assert.equal(await contact.isVisible(),true,'contact must not be hidden');
        const screenText=await page.locator('body').innerText();
        assert.match(screenText,/Non inviare documenti sensibili senza istruzioni/);
        if(scenario==='populated')assert.match(screenText,/Persona pubblica sintetica/);
        if(scenario==='empty')assert.match(screenText,/Nessuna classifica disponibile/);
        if(scenario==='api-failure'){
          assert.match(screenText,/Impossibile caricare la classifica/);
          assert.doesNotMatch(screenText,/SYNTHETIC_SQL_DETAILS|private_voting_personal_name/);
          assert.doesNotMatch(consoleEntries.join('\n'),/SYNTHETIC_SQL_DETAILS|private_voting_personal_name/);
        }
        const widths=await page.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth}));
        assert.ok(widths.page<=widths.viewport+2,'horizontal overflow '+JSON.stringify(widths));
        assert.ok(personalReads.length>=1,'expected a synthetic Grazia GET');
        assert.deepEqual(externalRequests,[],'no external network requests');
        await context.close();
        console.log('GRAZIA PRIVACY CHROME PASS '+scenario+' '+viewport.width+'x'+viewport.height);
      }
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
