// Guards the draft/invoice line-item editor in the drawer.
//
// Before: the drawer had inputs for description/qty/rate only — the SUBTITLE
// ("the subtext thing") had no field at all, so an item's detail line was
// invisible and impossible to edit. Also the amount recompute used a positional
// r.children[3], which any inserted field would silently break.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8692;
const DIR = __dirname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const fp = path.join(DIR, p);
      if (!fp.startsWith(DIR) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'text/plain' });
      fs.createReadStream(fp).pipe(r);
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
  });
}

let failed = 0;
const ok = m => console.log('PASS:', m);
const bad = m => { failed++; console.error('FAIL:', m); };
const check = (c, m) => c ? ok(m) : bad(m);

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(400);

  // ---- the subtitle field now exists in the drawer ----
  const present = await page.evaluate(async () => {
    const R = window.__reputifly, st = R.getState();
    const draft = Array.from(st.quotations.values())[0];
    R.openDrawer('quotation', draft.id);
    await new Promise(r => setTimeout(r, 350));
    return {
      desc: document.querySelectorAll('.drawer-item [data-k="description"]').length,
      sub: document.querySelectorAll('.drawer-item [data-k="subtitle"]').length,
      subShowsExisting: (document.querySelector('.drawer-item [data-k="subtitle"]') || {}).value,
      draftId: draft.id
    };
  });
  check(present.desc >= 1, 'description input present');
  check(present.sub >= 1, 'subtitle input NOW present in the drawer');
  check(present.subShowsExisting && present.subShowsExisting.length > 0, `existing subtitle is shown for editing ("${(present.subShowsExisting||'').slice(0,30)}")`);

  // ---- edit BOTH description and subtitle, save, confirm persisted ----
  const saved = await page.evaluate(async (draftId) => {
    const R = window.__reputifly, st = R.getState();
    const descEl = document.querySelector('.drawer-item [data-k="description"]');
    const subEl = document.querySelector('.drawer-item [data-k="subtitle"]');
    const rateEl = document.querySelector('.drawer-item [data-k="rate"]');
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(descEl, 'Website Design');
    set(subEl, 'Website Design Services (full end to end)');
    set(rateEl, '1234');
    // amount should have recomputed live (this is the children[3] bug guard)
    const amtLive = document.querySelector('.drawer-item .item-amt-input').value;
    // Save
    const saveBtn = [...document.querySelectorAll('#drawer-foot .btn')].find(b => b.textContent.trim() === 'Save changes');
    saveBtn.click();
    await new Promise(r => setTimeout(r, 700));
    const d = st.quotations.get(draftId);
    return {
      amtLive,
      item: d && d.items && d.items[0],
      itemAmount: d && d.items && d.items[0] && d.items[0].amount,
      total: d && d.total,
      itemsTotal: d && d.items && d.items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    };
  }, present.draftId);
  check(/1,234/.test(saved.amtLive), `amount recomputes live when rate changes (showed "${saved.amtLive}")`);
  check(saved.item && saved.item.description === 'Website Design', `saved description persisted ("${saved.item && saved.item.description}")`);
  check(saved.item && saved.item.subtitle === 'Website Design Services (full end to end)', `saved SUBTITLE persisted ("${saved.item && saved.item.subtitle}")`);
  check(saved.item && Number(saved.item.rate) === 1234, `saved rate persisted (${saved.item && saved.item.rate})`);
  check(saved.itemAmount === 1234, `edited item's amount is correct (${saved.itemAmount})`);
  check(saved.total === saved.itemsTotal, `total equals the sum of all items (total ${saved.total} = sum ${saved.itemsTotal})`);

  // ---- an existing item's subtitle is NOT wiped when you only touch description ----
  const preserve = await page.evaluate(async () => {
    const R = window.__reputifly, st = R.getState();
    const draft = Array.from(st.quotations.values()).find(q => q.items && q.items[0] && q.items[0].subtitle);
    if (!draft) return { skip: true };
    const beforeSub = draft.items[0].subtitle;
    R.openDrawer('quotation', draft.id);
    await new Promise(r => setTimeout(r, 350));
    const descEl = document.querySelector('.drawer-item [data-k="description"]');
    descEl.value = descEl.value + ' (edited)';
    descEl.dispatchEvent(new Event('input', { bubbles: true }));
    const saveBtn = [...document.querySelectorAll('#drawer-foot .btn')].find(b => b.textContent.trim() === 'Save changes');
    saveBtn.click();
    await new Promise(r => setTimeout(r, 700));
    return { beforeSub, afterSub: st.quotations.get(draft.id).items[0].subtitle };
  });
  if (preserve.skip) ok('(no item with a pre-set subtitle to test preservation — skipped)');
  else check(preserve.afterSub === preserve.beforeSub, `untouched subtitle preserved on save ("${preserve.afterSub}")`);

  // ---- works for a PAID invoice too (not just drafts) ----
  const paid = await page.evaluate(async () => {
    const R = window.__reputifly, st = R.getState();
    const inv = Array.from(st.invoices.values()).find(i => i.status !== 'void');
    if (!inv) return { skip: true };
    R.openDrawer('invoice', inv.id);
    await new Promise(r => setTimeout(r, 350));
    return { sub: document.querySelectorAll('.drawer-item [data-k="subtitle"]').length };
  });
  check(paid.skip || paid.sub >= 1, 'subtitle input also present when editing a paid invoice');

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK all drawer line-item checks passed');
  process.exit(failed ? 1 : 0);
})();
