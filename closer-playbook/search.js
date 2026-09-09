/* Local, deterministic lookup. No AI calls or customer chat uploads. */
(function () {
  'use strict';
  var originalSidebar = renderSidebar, originalHighlight = hlTag;
  var search = document.getElementById('search');
  var aliases = {
    quotation:'quote', proposal:'quote', pdf:'quote', quotations:'quote',
    photos:'photo', pictures:'photo', images:'photo', picture:'photo',
    revisions:'revision', changes:'change', edits:'edit', editing:'edit', update:'edit', updates:'edit',
    ecommerce:'checkout', commerce:'checkout', cart:'checkout', shop:'checkout', store:'checkout',
    price:'cost', pricing:'cost', prices:'cost', cheaper:'cheap', expensive:'cheap',
    emails:'email', mailbox:'email', renewal:'renew', renewals:'renew',
    meeting:'meet', meetings:'meet', zoom:'meet', call:'meet',
    payment:'pay', paid:'pay', paying:'pay', transfer:'pay', transferred:'pay',
    partners:'partner', boss:'partner', spouse:'partner', shareholders:'partner',
    pictures:'photo', missing:'missing', rankings:'rank', ranking:'rank', indexed:'index', indexing:'index'
  };
  var stop = new Set('a an the is are am i we you your my our me us it this that to for of in on with and or can could do does have has how what when will would should want need please just still'.split(' '));
  function normal(s) { return String(s||'').toLowerCase().replace(/e[ -]commerce/g,'ecommerce').replace(/<[^>]*>/g,' ').replace(/\[\[([^|]+)\|[^\]]+\]\]/g,'$1').replace(/[^a-z0-9]+/g,' ').trim(); }
  function words(s) { return normal(s).split(/\s+/).filter(Boolean).filter(function(w){return !stop.has(w);}).map(function(w){return aliases[w]||w;}); }
  function near(a,b) { if(a===b)return 1; if(a.length>=3&&b.indexOf(a)===0)return .85; if(a.length>=4&&b.length>=4&&Math.abs(a.length-b.length)<=1&&flev(a,b)<=1)return .6; return 0; }
  function score(query,title,body) {
    var tq=words(query),tw=words(title),bw=words(body);if(!tq.length)return 0;
    var total=0,matched=0;
    tq.forEach(function(q){var t=tw.reduce(function(v,w){return Math.max(v,near(q,w));},0),b=bw.reduce(function(v,w){return Math.max(v,near(q,w));},0);if(t||b){matched++;total+=t*9+b*2;}});
    if(matched!==tq.length)return 0;
    var phrase=normal(query);if(phrase&&normal(title).includes(phrase))total+=15;
    return total;
  }
  function plain(s) { return String(s||'').replace(/<[^>]*>/g,' ').replace(/\[\[([^|]+)\|[^\]]+\]\]/g,'$1').replace(/[\n\r*]+/g,' ').replace(/\s+/g,' ').trim(); }
  window.findPlaybook = function(query) {
    var hits=[];
    Object.keys(NODES).forEach(function(node){
      var n=NODES[node],menu=MENU.find(function(m){return m.id===node;})||{},items=[];
      (n.scripts||[]).forEach(function(s,i){
        var title=s.n||n.title,body=(s.sit||'')+' '+(s.t||''),value=score(query,title,body);
        if(value)items.push({node:node,path:s.route||(node+'/'+(s.id||'s'+i)),title:title,snippet:plain(s.t||s.sit),score:value});
      });
      var heading=score(query,n.title+' '+(menu.kw||''),(n.do||'')+' '+(n.readClient||'')+' '+(n.intake||[]).join(' '));
      if(heading)items.push({node:node,path:node,title:n.title,snippet:plain(n.do),score:heading});
      items.sort(function(a,b){return b.score-a.score;});
      hits.push.apply(hits,items.slice(0,2));
    });
    return hits.sort(function(a,b){return b.score-a.score;}).slice(0,18);
  };
  window.renderSidebar=function(filter){
    if(!String(filter||'').trim()){originalSidebar('');return;}
    var hits=findPlaybook(filter);
    sidescroll.innerHTML='<div class="search-summary" role="status">'+(hits.length?hits.length+' matching answers':'No exact match. Try a shorter phrase, like “missing photos” or “email renewal”.')+'</div>'+hits.map(function(h){return '<button class="srow search-result'+(h.node===curId?' active':'')+'" data-go="'+h.node+'" data-search-target="'+h.path+'"><div class="tx"><div class="tt">'+esc(h.title)+'</div><div class="ds">'+esc(NODES[h.node].title)+'</div><div class="search-excerpt">'+esc(h.snippet.slice(0,145))+(h.snippet.length>145?'…':'')+'</div></div></button>';}).join('');
  };
  sidescroll.addEventListener('click',function(e){var row=e.target.closest('[data-search-target]');if(!row)return;e.preventDefault();e.stopImmediatePropagation();go(row.dataset.searchTarget);},true);
  search.placeholder='Search a question, message or situation…';
  search.setAttribute('aria-label','Search all playbook messages and instructions');
  search.addEventListener('keydown',function(e){if(e.key==='Enter'){var first=sidescroll.querySelector('[data-search-target]');if(first){e.preventDefault();go(first.dataset.searchTarget);}}if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}});
  window.hlTag=function(tag){
    document.querySelectorAll('.message-hit').forEach(function(e){e.classList.remove('message-hit');});
    var el=tag==='do'?document.getElementById('field-do'):document.getElementById('script-'+tag);
    if(!el){originalHighlight(tag);return;}
    el.classList.add('message-hit');setTimeout(function(){el.scrollIntoView({block:'center',behavior:'smooth'});},40);
  };
  // Unlisted nodes remain accessible through the complete search index.
  renderSidebar(search.value);hlTag(location.hash.split('/')[1]||'');
})();
