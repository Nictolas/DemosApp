'use strict';
// Only synthetic network fixtures: no data source outside this local Chrome test.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const BASE='http://localhost:4173';
const ID='00000000-0000-4000-8000-000000008888';
const TOKEN=['eyJhbGciOiJub25lIn0',
 Buffer.from(JSON.stringify({userId:ID,role:'E',exp:4102444800})).toString('base64url'),
 'demos12-mounted-activist-only'].join('.');
function reply(route,data,status=200){
 return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),
 headers:{'cache-control':'no-store'}});
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const viewport of [{width:320,height:568},{width:390,height:844}]){
   const ctx=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
   const page=await ctx.newPage();
   const calls=[];
   await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(!url.pathname.startsWith('/api/'))
      return url.origin===BASE?route.continue():route.abort();
    calls.push(url.pathname);
    if(route.request().method()!=='GET')
      return reply(route,{success:false,error:'synthetic mutation blocked'},403);
    if(url.pathname==='/api/auth/me')
      return reply(route,{success:true,user:{id:ID,account_type:'E',status:'a',role:'E',ruolo:'E',
        political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
    if(url.pathname==='/api/attivisti')
      return reply(route,{success:true,data:[],approved_subjects:[
        {id:'90000000-0000-4000-8000-000000000001',title:'Soggetto pubblico sintetico'}]});
    if(url.pathname==='/api/attivisti/filtri')
      return reply(route,{success:true,data:{regioni:[],tipologie:[]}});
    return reply(route,{success:true,data:[]});
   });
   await page.goto(BASE+'/attivisti',{waitUntil:'domcontentloaded'});
   await page.getByText('Soggetto pubblico sintetico',{exact:true}).waitFor({timeout:20000});
   await page.getByRole('button',{name:/Proponi/i}).first().waitFor({timeout:15000});
   assert.equal(await page.getByText('Soggetto pubblico sintetico',{exact:true}).count(),1);
   assert.ok(calls.includes('/api/attivisti'),'uses configured API');
   assert.ok(!calls.includes('/api/subject-proposals/approved'),'no extra approved GET on mount');
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(layout.scroll<=layout.width+2,'no horizontal overflow');
   await ctx.close();
   console.log('MOUNTED ACTIVIST CHROME PASS '+viewport.width+'x'+viewport.height);
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});