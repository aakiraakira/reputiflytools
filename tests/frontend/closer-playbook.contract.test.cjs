const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../../closer-playbook');
function app(hash=''){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://reputifly.org/closer-playbook/'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
 w.fetch=()=>Promise.resolve({ok:true,text:()=>Promise.resolve(fs.readFileSync(path.join(root,'version.txt'),'utf8'))});
 for(const script of w.document.scripts){if(script.src){if(script.src.includes('/search.js'))w.eval(fs.readFileSync(path.join(root,'search.js'),'utf8'));}else w.eval(script.textContent);}
 return dom;
}
test('every node renders, every route resolves, copied text stays plain',()=>{
 const dom=app(),w=dom.window;
 assert.equal(Object.keys(w.NODES).length,30);
 for(const [id,n] of Object.entries(w.NODES)){
  w.render(id);assert.equal(w.document.querySelector('.nodehd').textContent,n.title,id);
  for(const x of n.next||[]){const [node,tag]=x.to.split('/');assert(w.NODES[node],x.to);if(tag)assert(w.NODES[node].scripts.some(s=>s.id===tag),x.to);}
  for(const [i,s] of (n.scripts||[]).entries()){
   if(s.route)continue;
   assert(w.document.getElementById('script-'+(s.id||'s'+i)),id+' script target');
   assert.equal(w.curScripts[i],s.t,id+' copy');
   assert(!/\[\[|Agreed In Principle|Proposed Replacement|verified client-review link/.test(s.t),id+' leaked review metadata');
  }
  for(const a of w.document.querySelectorAll('a.staff-ref')){const [node,tag]=a.hash.slice(1).split('/');assert(w.NODES[node],a.hash);if(tag)assert(w.NODES[node].scripts.some(s=>s.id===tag),a.hash);assert.equal(a.target,'_blank');}
 }
 assert.equal(w.PB_BUILD,fs.readFileSync(path.join(root,'version.txt'),'utf8').trim());dom.window.close();
});
test('approved final corrections and protected close',()=>{
 const dom=app(),n=dom.window.NODES;
 assert.match(n.reveal.scripts.find(s=>s.id==='s1').t,/anything you want to change, i'll sort it out/);
 assert.match(n.price.scripts.find(s=>s.id==='s2').t,/we handle the work after too/);
 assert.match(n.close_asks.scripts[0].t,/changes and revisions/);
 assert.match(n.close_asks.scripts.find(s=>s.id==='s3').t,/extra \$500/);
 assert.match(n.store.do,/extra \$500/);
 assert.match(n.meet.scripts.find(s=>s.id==='s0').t,/a lot more efficient/);
 assert.match(n.faq.scripts.find(s=>s.id==='s12').t,/renewing the hosting with your provider/);
 assert.match(n.credibility.scripts.map(s=>s.t).join(' '),/v34maWPeR28V5H6Z7/);
 assert(!n.faq.scripts.some(s=>s.n==='Their actual page plan is known'));
 assert.equal(n.answered.scripts[0].t,'Hi thanks. Let me know when transferred');
 assert.match(n.payment.do,/replaces that day/);
 assert.match(n.answered.scripts[0].sit,/No earlier reminder that day/);
 assert(!dom.window.MENU.some(m=>['react, don’t reply','one nudge only','7-day decay = urgency'].includes(m.ds)));
 assert.equal(n.tree.scripts[0].t,"the total price for the project is *$590*, we just require a *70% deposit* which is *$413*\nthose changes are extremely easy, don't worry\n\nshall we start the project?");
 const att=n.price.attachments[0];
 assert.equal(att.url,'../upsell-playbook/Reputifly-Case-Study-Google-and-AI-Results.pdf');
 assert.equal(att.file,'Reputifly Case Study - Google and AI Results.pdf');
 assert(fs.existsSync(path.resolve(root,att.url)),'the case study PDF is missing from the repo');
 assert.deepEqual(n.credibility.attachments[0],att,'credibility must offer the same case study');
 assert(!JSON.stringify(n.close_wobble.asset).includes('Proposed image text correction'));
 dom.window.close();
});
test('search finds messages beyond sidebar labels and tolerates common wording',()=>{
 const dom=app(),w=dom.window;
 for(const [q,node] of [['is SEO included','faq'],['email renewal','faq'],['ecommerce','close_asks'],['quotation','close_asks'],['missing photos','close'],['how do i update','faq'],['depost','close_asks']]){
  const hits=w.findPlaybook(q);assert(hits.some(h=>h.node===node),q+' missing '+node+' '+JSON.stringify(hits));
 }
 w.renderSidebar('email renewal');const button=w.document.querySelector('[data-search-target]');assert(button);button.click();assert.equal(w.curId,'faq');assert.match(w.location.hash,/faq\/s/);
 w.renderSidebar('<img onerror=alert(1)>');assert.equal(w.document.querySelectorAll('#sidescroll img').length,0);
 dom.window.close();
});
test('deep links, additions and copy actions survive rendering',async()=>{
 const dom=app('#close_asks/s1'),w=dom.window;assert.equal(w.curId,'close_asks');assert(w.document.getElementById('script-s1'));
 w.go('price/s2');assert.equal(w.location.hash,'#price/s2');
 w.go('faq/s21');assert.equal(w.curId,'faq');assert(w.document.getElementById('script-s21'));
 let copied;Object.defineProperty(w.navigator,'clipboard',{value:{writeText:t=>{copied=t;return Promise.resolve();}}});
 w.document.querySelector('#script-s21 .copybtn').click();await Promise.resolve();assert.equal(copied,w.NODES.faq.scripts.find(s=>s.id==='s21').t);
 w.go('price');
 const card=w.document.querySelector('.asset-status');
 assert(!/PDF pending/.test(card.textContent),'the case study is attached, the pending note must be gone');
 const dl=card.querySelector('a[download]');
 assert(dl,'the case study download button is missing');
 assert.equal(dl.getAttribute('href'),'../upsell-playbook/Reputifly-Case-Study-Google-and-AI-Results.pdf');
 assert.equal(dl.getAttribute('download'),'Reputifly Case Study - Google and AI Results.pdf');
 assert.match(card.textContent,/Send the file, never the link/,'the WhatsApp instruction must survive rendering');
 w.go('credibility');assert(w.document.querySelector('.portfolio-shortlist a'));
 assert(w.document.querySelector('.asset-status a[download]'),'credibility must render the case study download too');
 dom.window.close();
});
