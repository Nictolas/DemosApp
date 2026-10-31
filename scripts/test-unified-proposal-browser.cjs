'use strict';
// Only localhost, synthetic authentication and mocked proposal API. Never contact production.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const BASE = 'http://localhost:4173';
const ID = '00000000-0000-4000-8000-000000008888';
const TOKEN = [
  'eyJhbGciOiJub25lIn0',
  Buffer.from(JSON.stringify({userId: ID, role:'E', exp:4102444800})).toString('base64url'),
  'unified-proposals-synthetic-browser-only',
].join('.');
const SIZES = [{width:320,height:568},{width:390,height:844}];
function response(route,status,data) {
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'cache-control':'no-store'}});
}

async function main() {
  const browser = await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});
  try {
    for (const viewport of SIZES) {
      const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'});
      await context.addInitScript(token=>localStorage.setItem('auth_token',token),TOKEN);
      const page=await context.newPage();
      const posts=[], proposalReads=[];
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==BASE)return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        if(url.pathname==='/api/auth/me')return response(route,200,{
          success:true,user:{id:ID,email:'',status:'a',ruolo:'E',role:'E',account_type:'E',
          political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
        if(url.pathname.startsWith('/api/subject-proposals')){
          if(route.request().method()==='GET'){
            proposalReads.push(url.pathname);
            return response(route,500,{success:false,error:'No GET should be needed'});
          }
          if(route.request().method()==='POST'&&url.pathname==='/api/subject-proposals'){
            const data=route.request().postDataJSON();
            posts.push(data);
            return response(route,201,{success:true,status:'pending',proposal:{id:'synthetic-'+posts.length}});
          }
        }
        if(route.request().method()!=='GET')return response(route,403,{success:false,error:'Blocked synthetic mutation'});
        return response(route,200,{success:true,data:[]});
      });
      await page.goto(BASE+'/proponi-soggetto?categoria=grazia',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Proponi',exact:true}).waitFor({timeout:30000});
      const select=page.getByLabel('Che cosa vuoi proporre?');
      assert.equal(await select.inputValue(),'grazia','contextual preselect from URL');
      assert.equal(await select.locator('option').count(),5,'all five categories in one dropdown');
      assert.equal(await page.locator('#subject-details').count(),0,'Grazia must not solicit judicial details');
      assert.equal(proposalReads.length,0,'zero proposal-specific reads on initial mount');

      const submit=page.getByRole('button',{name:'Invia per approvazione'});
      await page.locator('#subject-title').fill('Persona completamente sintetica');
      await page.locator('#subject-source').fill('http://example.org/insecure');
      assert.equal(await submit.isDisabled(),true,'HTTPS source mandatory');
      await page.locator('#subject-source').fill('https://example.org/pubblica');
      assert.equal(await submit.isDisabled(),false);
      await submit.click();
      await page.getByText('Proposta registrata.',{exact:false}).waitFor({timeout:15000});
      assert.equal(posts.length,1);
      assert.equal(posts[0].category,'grazia');
      assert.equal(posts[0].details,'');
      assert.equal(posts[0].source_url,'https://example.org/pubblica');
      assert.equal(proposalReads.length,0,'no proposal query after submission');

      await select.selectOption('organizzazioni');
      assert.equal(await page.locator('#subject-details').count(),1,'other categories may add public details');
      await page.locator('#subject-title').fill('Organizzazione sintetica');
      await page.locator('#subject-details').fill('Fonte pubblica, senza dati privati');
      await page.locator('#subject-source').fill('https://example.org/organizzazione');
      await submit.click();
      await page.getByText('Proposta registrata.',{exact:false}).waitFor({timeout:15000});
      assert.equal(posts.length,2);
      assert.equal(posts[1].category,'organizzazioni');
      assert.equal(posts[1].details,'Fonte pubblica, senza dati privati');
      assert.equal(proposalReads.length,0,'category switches do not hit proposal API');
      const metrics=await page.evaluate(()=>({
        total:document.documentElement.scrollWidth,
        viewport:window.innerWidth,
        current:document.querySelector('#subject-category')?.value,
        heading:document.querySelector('h1')?.textContent,
      }));
      assert.ok(metrics.total<=metrics.viewport+2,'mobile page must not overflow horizontally: '+JSON.stringify(metrics));
      assert.equal(metrics.current,'organizzazioni');
      // Changing the selected category must not change the origin of the Back button.
      await page.getByRole('button',{name:'Torna alla sezione'}).click();
      await page.waitForURL('**/grazia',{timeout:15000});
      await page.goto(BASE+'/proponi-soggetto?da=firma',{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'Proponi',exact:true}).waitFor({timeout:30000});
      await page.getByRole('button',{name:'Torna alla sezione'}).click();
      await page.waitForURL('**/firma',{timeout:15000});
      assert.equal(proposalReads.length,0,'navigation to source remains GET-free for proposals');
      await context.close();
      console.log('UNIFIED PROPOSALS browser PASS '+viewport.width+'x'+viewport.height+
        ': two submissions, no proposal-specific GET');
    }
  }finally{await browser.close();}
}
main().catch(err=>{console.error(err.stack||err.message);process.exitCode=1;});
