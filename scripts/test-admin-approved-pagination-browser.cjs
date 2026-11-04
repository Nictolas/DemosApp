'use strict';
// DEMOS12: Chrome localhost only; synthetic Admin identity, mocked API.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4174';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'demos12-pagination-synthetic-test'].join('.');
const SIZES=[{width:320,height:568},{width:390,height:844}];
const rows=Array.from({length:105},(_,i)=>({
 id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),
 category:'organizzazioni',title:'Pubblicata sintetica '+(i+1),
 reviewed_at:i<100?'2026-11-04T12:00:00.000Z':'2026-10-04T12:00:00.000Z'
}));
function reply(route,obj,status=200){
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(obj),
  headers:{'cache-control':'no-store'}});
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
 try{
  for(const viewport of SIZES){
   const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
   const page=await ctx.newPage(), urls=[];
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==BASE)return route.abort();
    if(!url.pathname.startsWith('/api/'))return route.continue();
    if(url.pathname==='/api/auth/me')
     return reply(route,{success:true,user:{
      id:ID,is_admin:true,account_type:'E',status:'a',role:'E',ruolo:'E',
      political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}
     }});
    if(url.pathname==='/api/subject-proposals/admin')
     return reply(route,{success:true,proposals:[]});
    if(url.pathname==='/api/subject-proposals/admin/approved'){
      urls.push(url.toString());
      if(url.searchParams.get('cursor')==='next-synthetic-page')
       return reply(route,{success:true,proposals:rows.slice(100),next_cursor:null});
      if(url.searchParams.has('cursor'))return reply(route,{success:false,error:'unexpected cursor'},400);
      return reply(route,{success:true,proposals:rows.slice(0,100),next_cursor:'next-synthetic-page'});
    }
    if(route.request().method()!=='GET')return reply(route,{success:false,error:'Synthetic mutation blocked'},403);
    return reply(route,{success:true,data:[]});
   });
   await page.goto(BASE+'/gestisci/proposte-soggetti',{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Proposte di nuovi soggetti'}).waitFor({timeout:20000});
   assert.equal(urls.length,0,'approved rows must not load automatically');
   await page.getByRole('button',{name:'Pubblicate',exact:true}).click();
   await page.getByText('Pubblicata sintetica 100',{exact:true}).waitFor({timeout:16000});
   assert.equal(urls.length,1,'one initial page after Admin click');
   const more=page.getByRole('button',{name:'Carica altre pubblicazioni'});
   await more.waitFor({timeout:15000});
   await more.click();
   await page.getByText('Pubblicata sintetica 105',{exact:true}).waitFor({timeout:15000});
   assert.equal(urls.length,2,'next page fetched on explicit click');
   assert.equal(await page.getByText('Pubblicata sintetica 1',{exact:true}).count(),1,'no duplicate first page');
   assert.equal(await page.getByRole('button',{name:'Carica altre pubblicazioni'}).count(),0,'end of list hides load more');
   assert.equal(await page.locator('article').count(),105,'all 105 Admin publications accessible');
   const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,view:innerWidth}));
   assert.ok(metrics.scroll<=metrics.view+2,'no horizontal overflow on mobile');
   await ctx.close();
   console.log('ADMIN PAGINATION CHROME PASS '+viewport.width+'x'+viewport.height);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
