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
      const posts=[], graziaPosts=[], proposalReads=[], graziaReads=[];
      let authUserId=ID, authReads=0;
      const SECOND_ID='00000000-0000-4000-8000-000000009999';
      let unblockOldStatus;
      let notifyOldStatusStarted;
      const oldStatusStarted=new Promise(resolve=>{notifyOldStatusStarted=resolve;});
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==BASE)return route.abort();
        if(!url.pathname.startsWith('/api/'))return route.continue();
        if(url.pathname==='/api/auth/me'){
          authReads++;
          return response(route,200,{
          success:true,user:{id:authUserId,email:'',status:'a',ruolo:'E',role:'E',account_type:'E',
          political_consent:{granted:true,timestamp:'2026-10-01T00:00:00Z'}}});
        }
        if(url.pathname==='/api/grazia/mia-proposta'&&route.request().method()==='GET'){
          graziaReads.push(url.pathname);
          return response(route,200,{success:true,richiesta:{id:'grazia-synthetic',status:'pending'}});
        }
        if(url.pathname==='/api/grazia'&&route.request().method()==='POST'){
          const data=route.request().postDataJSON();
          graziaPosts.push(data);
          return response(route,202,{success:true,richiesta:{id:'grazia-synthetic-'+graziaPosts.length,status:'pending'}});
        }
        if(url.pathname.startsWith('/api/subject-proposals')){
          if(route.request().method()==='GET'){
            proposalReads.push(url.pathname);
            if(url.pathname==='/api/subject-proposals/mine'&&url.searchParams.get('category')==='capo_stato'){
              return new Promise((resolve,reject)=>{
                unblockOldStatus=()=>response(route,200,{success:true,latest:{id:'stale-capo',status:'pending'}}).then(resolve,reject);
                notifyOldStatusStarted();
              });
            }
            if(url.pathname==='/api/subject-proposals/mine'&&url.searchParams.get('category')==='organizzazioni'){
              return response(route,200,{success:true,pending:null,latest:{id:'org-synthetic',status:'approved'}});
            }
            return response(route,500,{success:false,error:'No unsolicited GET should be needed'});
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
      assert.equal(graziaPosts.length,1,'Grazia uses the existing dedicated queue');
      assert.equal(graziaPosts[0].nome,'Persona completamente sintetica');
      assert.equal(graziaPosts[0].urlProva,'https://example.org/pubblica');
      assert.equal(Object.keys(graziaPosts[0]).length,2,'no judicial details in Grazia');
      assert.equal(posts.length,0,'Grazia never writes the generic subject proposals queue');
      assert.equal(proposalReads.length,0,'no proposal query after submission');
      assert.equal(graziaReads.length,0,'no Grazia status query until an explicit click');
      await page.getByRole('button',{name:'Verifica stato della mia proposta'}).click();
      await page.getByText('La proposta è in attesa di valutazione.').waitFor({timeout:15000});
      assert.equal(graziaReads.length,1,'Grazia status reads only on user action');

      await select.selectOption('organizzazioni');
      assert.equal(await page.locator('#subject-details').count(),1,'other categories may add public details');
      await page.locator('#subject-title').fill('Organizzazione sintetica');
      await page.locator('#subject-details').fill('Fonte pubblica, senza dati privati');
      await page.locator('#subject-source').fill('https://example.org/organizzazione');
      await submit.click();
      await page.getByText('Proposta registrata.',{exact:false}).waitFor({timeout:15000});
      assert.equal(posts.length,1);
      assert.equal(posts[0].category,'organizzazioni');
      assert.equal(posts[0].details,'Fonte pubblica, senza dati privati');
      assert.equal(proposalReads.length,0,'category switches do not hit proposal API');
      await page.getByRole('button',{name:'Verifica stato della mia proposta'}).click();
      await page.getByText('La proposta è stata approvata.').waitFor({timeout:15000});
      assert.equal(proposalReads.length,1,'generic status reads only after explicit click');

      // A stale response must never appear under the next selected category.
      await select.selectOption('capo_stato');
      await page.getByRole('button',{name:'Verifica stato della mia proposta'}).click();
      await oldStatusStarted;
      await select.selectOption('organizzazioni');
      const statusCheck=page.getByRole('button',{name:'Verifica stato della mia proposta'});
      assert.equal(await statusCheck.isDisabled(),false,
        'switching categories unlocks the check for the new category');
      await statusCheck.click();
      await page.getByText('La proposta è stata approvata.').waitFor({timeout:15000});
      assert.ok(unblockOldStatus,'old request must be pending for this race');
      unblockOldStatus();
      await page.waitForTimeout(80);
      assert.equal(await page.getByText('La proposta è stata approvata.').count(),1,
        'the old Capo status must not overwrite the Organizzazioni status');
      assert.equal(await page.getByText('La proposta è in attesa di valutazione.').count(),0,
        'the outdated status must not appear under the new category');
      assert.equal(proposalReads.length,3,'only the three explicitly requested status GETs');

      // A personal result from account A must disappear when /auth/me
      // revalidates a different account in this same mounted form.
      authUserId=SECOND_ID;
      const newTab=await context.newPage();
      await newTab.goto('about:blank');
      await newTab.bringToFront();
      await page.bringToFront();
      await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
      await page.waitForFunction(()=>document.querySelector('#subject-title')?.value==='', {timeout:15000});
      await page.getByText('La proposta è stata approvata.').waitFor({state:'detached',timeout:15000});
      assert.ok(authReads>=2,'switching the synthetic auth identity must revalidate /auth/me');
      assert.equal(await page.getByRole('status').count(),0,
        'old-account private status must not be shown after account change');
      assert.equal(proposalReads.length,3,'account changes must not auto-read proposal status');
      await newTab.close();
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
      assert.equal(proposalReads.length,3,'navigation never performs additional proposal reads');
      await context.close();
      console.log('UNIFIED PROPOSALS browser PASS '+viewport.width+'x'+viewport.height+
        ': one Grazia POST + one generic POST; status GETs only after explicit clicks');
    }
  }finally{await browser.close();}
}
main().catch(err=>{console.error(err.stack||err.message);process.exitCode=1;});
