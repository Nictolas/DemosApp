'use strict';
// Chrome mobile browser: synthetic-only data; no real API calls, users, databases or sessions.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = 'http://localhost:4173';
const ID = '00000000-0000-4000-8000-000000008888';
const SECRET = 'FICTIONAL_PRIVATE_MARKER_9d2_no_real_person';
const TOKEN = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
  'public-directory-hotfix-synthetic'
].join('.');

function reply(route, body, status=200) {
  return route.fulfill({
    status,contentType:'application/json',
    headers:{'cache-control':'no-store'},
    body:JSON.stringify(body)
  });
}
const items={
  attivisti:{
    id:'11111111-1111-4111-8111-111111111111',
    nome:'Attivista',cognome:'Sintetico',ruolo:'A',status:'a',
    supporters_count:2,regione_residenza:'TO',
    avatar_config:JSON.stringify({hairColor:'#123456',hairStyle:'short'}),
    tipologie_attivismo:[{tipo:'ambiente',nome:'Ambiente'}],
    email:SECRET,moderation_note:SECRET
  },
  organizzazioni:{
    id:'22222222-2222-4222-8222-222222222222',
    nome:'Organizzazione',cognome:'Sintetica',ruolo:'O',status:'a',
    supporters_count:3,regione_residenza:'TO',
    avatar_config:JSON.stringify({hairColor:'#123456',hairStyle:'short'}),
    tipologie_attivismo:[{tipo:'ambiente',nome:'Ambiente'}],
    email:SECRET,moderation_note:SECRET
  }
};

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:320,height:568},{width:390,height:844}]){
   const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
   await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
   const page=await context.newPage();
   const consoleLines=[],routesSeen=[];
   page.on('console',msg=>consoleLines.push(msg.text()));
   page.on('pageerror',err=>consoleLines.push(err.message));
   await page.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(!url.pathname.startsWith('/api/'))
       return url.origin===BASE?route.continue():route.abort();
     routesSeen.push(url.pathname);
     if(route.request().method()!=='GET')
       return reply(route,{success:false,error:'synthetic mutation blocked'},403);
     if(url.pathname==='/api/auth/me')
       return reply(route,{success:true,user:{
         id:ID,role:'E',ruolo:'E',account_type:'E',status:'a',
         political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}
       }});
     if(url.pathname==='/api/attivisti')
       return reply(route,{success:true,data:[items.attivisti],count:1});
     if(url.pathname==='/api/organizzazioni')
       return reply(route,{success:true,data:[items.organizzazioni],count:1});
     if(url.pathname==='/api/attivisti/filtri' || url.pathname==='/api/organizzazioni/filtri')
       return reply(route,{success:true,data:{regioni:[],tipologie:[]}});
     return reply(route,{success:true,data:[],count:0});
   });

   for(const [category,expected] of [
     ['attivisti','Attivista Sintetico'],
     ['organizzazioni','Organizzazione Sintetica']
   ]){
     await page.goto(BASE+'/'+category,{waitUntil:'domcontentloaded'});
     await page.waitForFunction(name=>document.body.innerText.includes(name),
       expected,{timeout:25000});
     const text=await page.locator('body').innerText();
     assert.ok(text.includes(expected),category+' must still render allowed public profile data');
     assert.ok(!text.includes(SECRET),category+' must not render synthetic private data');
     const relevant=routesSeen.filter(x=>x==='/api/'+category);
     assert.ok(relevant.length>0,category+' must use its ordinary public directory GET');
   }
   assert.doesNotMatch(consoleLines.join('\n'),new RegExp(SECRET),
     'raw response, search or private fixture must not be logged in Chrome');
   await context.close();
   console.log('PUBLIC DIRECTORY HOTFIX CHROME PASS '+viewport.width+'x'+viewport.height);
  }
 }finally{await browser.close();}
})().catch(err=>{console.error(err.stack||err.message);process.exitCode=1;});
