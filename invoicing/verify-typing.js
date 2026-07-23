// End-to-end guard for the "my text disappears while the app is still loading"
// class of bug, and its sibling in the drawer.
//
// Two independent causes, both covered here:
//   1. bootstrapData() finished with an unconditional initDraft(), REPLACING
//      state.draft — no repaint-guarding survives the object being swapped.
//   2. render() rebuilds the drawer too (it's route-independent), and the
//      drawer's line-item editor holds its own working copy, so a background
//      snapshot mid-edit discarded it.
// Also asserts the things the fix must NOT break: the invoice/quote number
// still updates, and the draft still saves with the typed content.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8690;
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

const TYPED_CLIENT = 'Typed Before Load Pte Ltd';
const TYPED_ITEM = 'Website Design (70% Deposit)';

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => bad('pageerror: ' + e.message));

  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(400);

  // ---- 1. typing survives the bootstrap tail (initDraft) ----
  const r1 = await page.evaluate(({ c, i }) => {
    const R = window.__reputifly, st = R.getState();
    R.setRoute('creation'); R.forceRender();
    const nameEl = document.querySelector('#creation-wrap .party-name.ce');
    const descEl = document.querySelector('#creation-wrap .item-desc-main');
    nameEl.focus();
    nameEl.textContent = c; nameEl.dispatchEvent(new Event('input', { bubbles: true }));
    descEl.textContent = i; descEl.dispatchEvent(new Event('input', { bubbles: true }));
    nameEl.focus();
    R._test_initDraft();                 // what bootstrapData() now does
    R._test_renderBackground();          // and its repaint
    return { client: st.draft.client.name, item: st.draft.items[0].description, deferred: R._test_pendingBgRender() };
  }, { c: TYPED_CLIENT, i: TYPED_ITEM });
  check(r1.client === TYPED_CLIENT, `client name survives bootstrap (got "${r1.client}")`);
  check(r1.item === TYPED_ITEM, `line item survives bootstrap (got "${r1.item}")`);
  check(r1.deferred === true, 'repaint deferred while the field has focus');

  // ---- 2. the number STILL loads once focus leaves ----
  const r2 = await page.evaluate(() => {
    const R = window.__reputifly, st = R.getState();
    st.counters.quotation = { value: 75, prefix: 'QINV-', padding: 3 };
    R._test_renderBackground();                       // snapshot lands while focused -> deferred
    const deferredWhileTyping = R._test_pendingBgRender();
    document.querySelector('#creation-wrap .party-name.ce').blur();
    document.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return { deferredWhileTyping };
  });
  check(r2.deferredWhileTyping === true, 'number update deferred, not dropped, while typing');
  await page.waitForTimeout(120);
  const flushed = await page.evaluate(() => ({
    pending: window.__reputifly._test_pendingBgRender(),
    numberShown: document.body.innerText.match(/QINV-\d+/) && document.body.innerText.match(/QINV-\d+/)[0],
    clientStill: window.__reputifly.getState().draft.client.name
  }));
  check(flushed.pending === false, 'deferred repaint flushes after focus leaves');
  check(flushed.numberShown === 'QINV-076', `number updated to the latest (got ${flushed.numberShown})`);
  check(flushed.clientStill === TYPED_CLIENT, 'text still intact after the flush');

  // ---- 3. it still SAVES with the typed content ----
  const saved = await page.evaluate(async () => {
    const R = window.__reputifly, st = R.getState();
    const before = st.quotations.size;
    document.getElementById('save-and-share')?.click();
    await new Promise(r => setTimeout(r, 700));
    const after = st.quotations.size;
    const newest = Array.from(st.quotations.values()).sort((a, b) => (b.number || 0) - (a.number || 0))[0];
    return { before, after, client: newest && newest.client && newest.client.name, item: newest && newest.items && newest.items[0] && newest.items[0].description };
  });
  check(saved.after === saved.before + 1, `draft saved (${saved.before} -> ${saved.after})`);
  check(saved.client === TYPED_CLIENT, `saved doc has the typed client (got "${saved.client}")`);
  check(saved.item === TYPED_ITEM, `saved doc has the typed line item (got "${saved.item}")`);

  // ---- 4. drawer line-item description edit survives a background render ----
  const drawer = await page.evaluate(async () => {
    const R = window.__reputifly, st = R.getState();
    const inv = Array.from(st.invoices.values())[0];
    R.openDrawer('invoice', inv.id);
    await new Promise(r => setTimeout(r, 350));
    const input = document.querySelector('.drawer-item .item-desc-input');
    if (!input) return { error: 'no drawer line-item input' };
    input.focus();
    input.value = 'EDITED DESCRIPTION';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    R._test_renderBackground();
    await new Promise(r => setTimeout(r, 120));
    const after = document.querySelector('.drawer-item .item-desc-input');
    return {
      sameNode: after === input,
      value: after ? after.value : '(gone)',
      caretKept: document.activeElement === after
    };
  });
  check(!drawer.error, 'drawer line-item editor reachable');
  check(drawer.value === 'EDITED DESCRIPTION', `drawer edit survives a background render (got "${drawer.value}")`);
  check(drawer.sameNode === true, 'drawer input node not rebuilt under the cursor');
  check(drawer.caretKept === true, 'caret stays in the drawer field');

  // ---- 5. user-initiated renders must STILL repaint immediately ----
  const userRender = await page.evaluate(() => {
    const R = window.__reputifly, st = R.getState();
    R.setRoute('creation'); R.forceRender();
    const before = document.querySelector('#creation-wrap .party-name.ce');
    st.draft.items.push({ description: 'Second item', subtitle: '', qty: 1, rate: 100, amount: 100 });
    R.forceRender();
    const after = document.querySelector('#creation-wrap .party-name.ce');
    return { rebuilt: before !== after, items: document.querySelectorAll('#creation-wrap .item-desc-main').length };
  });
  check(userRender.rebuilt === true, 'user-initiated render still repaints instantly (guard does not block it)');
  check(userRender.items >= 2, `added line item is rendered (${userRender.items} items)`);

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK all typing/edit-persistence checks passed');
  process.exit(failed ? 1 : 0);
})();
