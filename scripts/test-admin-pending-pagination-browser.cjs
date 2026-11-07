'use strict';
// Synthetic Admin and API: Chrome localhost only, never production or real accounts.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4176';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'demos12-pending-browser-only'].join('.');
const SIZES=[{width:320,height:568},{width:390,height:844}];
const rows=Array.from({length:105},(_,i)=>({
 id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 category:'organizzazioni',title:'Richiesta sintetica '+(i+1),
 details:'Solo dati sintetici',source_url:'https://example.org/demos12',
 created_at:i<100?'2026-11-04T12:00:00.000Z':'2026-11-04T12:00:01.000Z'
}));
function reply(route,obj,status=200){
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj),
 headers:{'cache-control':'private, no-store'}});
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
 try{
  for(const viewport of SIZES){
   const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
   const page=await ctx.newPage();const urls=[];
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==BASE)return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    if(url.pathname==='/api/auth/me')return reply(route,{success:true,user:{
     id:ID,is_admin:true,account_type:'E',status:'a',role:'E',ruolo:'E',
     political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}
    }});
    if(url.pathname==='/api/subject-proposals/admin'){
      urls.push(url.toString());
      const cursor=url.searchParams.get('cursor');
      if(cursor==='synthetic-next')return reply(route,{success:true,proposals:rows.slice(100),next_cursor:null});
      if(cursor)return reply(route,{success:false,error:'Unexpected cursor'},400);
      return reply(route,{success:true,proposals:rows.slice(0,100),next_cursor:'synthetic-next'});
    }
    if(route.request().method()!=='GET')return reply(route,{success:false,error:'Synthetic mutations blocked'},403);
    return reply(route,{success:true,data:[]});
   });
   await page.goto(BASE+'/gestisci/proposte-soggetti',{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Proposte di nuovi soggetti'}).waitFor({timeout:20000});
   await page.getByText('Richiesta sintetica 100',{exact:true}).waitFor({timeout:20000});
   assert.equal(urls.length,1,'only first pending page loads on mount');
   const more=page.getByRole('button',{name:'Carica altre richieste'});
   await more.waitFor({timeout:16000});
   await more.click();
   await page.getByText('Richiesta sintetica 105',{exact:true}).waitFor({timeout:16000});
   assert.equal(urls.length,2,'next pending page loads only after Admin click');
   assert.equal(await page.getByRole('button',{name:'Carica altre richieste'}).count(),0);
   assert.equal(await page.getByText('Richiesta sintetica 1',{exact:true}).count(),1);
   assert.equal(await page.locator('article').count(),105);
   const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(layout.scroll<=layout.width+2,'mobile cannot overflow horizontally');
   await ctx.close();
   console.log('PENDING MODERATION CHROME PASS '+viewport.width+'x'+viewport.height);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
