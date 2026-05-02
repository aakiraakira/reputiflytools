/**
 * ui-audit.js — End-to-end interaction tests against the SPA.
 * Verifies that every feature in the plan actually works (no placeholders).
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = __dirname;
const PORT = 8282;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml'
};
function startServer() {
  return new Promise((res, rej) => {
    const s = http.createServer((req, r) => {
      try {
        let p = decodeURIComponent((req.url || '/').split('?')[0]);
        if (p === '/' || p === '') p = '/index.html';
        const fp = path.join(PROJECT_DIR, p);
        if (!fp.startsWith(PROJECT_DIR)) { r.writeHead(403); r.end(); return; }
        if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) { r.writeHead(404); r.end(); return; }
        const ext = path.extname(fp).toLowerCase();
        r.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        fs.createReadStream(fp).pipe(r);
      } catch (e) { r.writeHead(500); r.end(String(e)); }
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
    s.on('error', rej);
  });
}

let failures = 0;
const fail = (msg) => { failures++; console.error('  FAIL:', msg); };
const pass = (msg) => console.log('  PASS:', msg);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.error('  [pageerror]', e.message); });
  page.on('console', m => { if (m.type() === 'error') console.error('  [console.error]', m.text()); });

  try {
    console.log('Loading SPA in dev mode...');
    await page.goto('http://127.0.0.1:' + PORT + '/index.html?dev=1');
    await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await page.waitForTimeout(800);

    // 1. Tab navigation
    console.log('\n[1] Tab navigation');
    for (const tab of ['quotations', 'invoices', 'advanced', 'creation']) {
      await page.evaluate(t => window.__reputifly.setRoute(t), tab);
      await page.waitForTimeout(120);
      const active = await page.evaluate(() => {
        const el = document.querySelector('.tab-btn.active');
        return el ? el.dataset.route : null;
      });
      if (active === tab) pass('tab -> ' + tab);
      else fail('tab -> ' + tab + ' (got ' + active + ')');
    }

    // 2. Creation tab
    console.log('\n[2] Creation tab');
    await page.evaluate(() => window.__reputifly.setRoute('creation'));
    await page.waitForTimeout(200);
    await page.locator('.add-item-row').click();
    await page.locator('.add-item-row').click();
    const itemRows = await page.locator('.editor-page .item-row').count();
    if (itemRows === 3) pass('add-item-row added rows (count=' + itemRows + ')');
    else fail('add-item-row should yield 3 rows, got ' + itemRows);

    await page.locator('.editor-page .item-row .row-trash button').first().click();
    await page.waitForTimeout(120);
    const after = await page.locator('.editor-page .item-row').count();
    if (after === 2) pass('row-trash removed a row');
    else fail('row-trash should leave 2, got ' + after);

    await page.locator('.editor-page .party-name.ce').click();
    await page.keyboard.type('Test Client Co');
    await page.locator('.editor-page').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(120);
    const name = await page.evaluate(() => window.__reputifly.getState().draft.client.name);
    if (name === 'Test Client Co') pass('contenteditable client name persists');
    else fail('client name = "' + name + '"');

    const qtyInput = page.locator('.editor-page .item-row input[data-field="qty"]').first();
    await qtyInput.fill('5');
    const rateInput = page.locator('.editor-page .item-row input[data-field="rate"]').first();
    await rateInput.fill('250');
    await rateInput.blur();
    await page.waitForTimeout(150);
    const total = await page.evaluate(() => window.__reputifly.getState().draft.total);
    if (total === 1250) pass('totals recompute (5x250 = ' + total + ')');
    else fail('totals: expected 1250, got ' + total);

    // 3. Save quotation
    console.log('\n[3] Save quotation flow');
    const beforeCount = await page.evaluate(() => window.__reputifly.getState().quotations.size);
    await page.locator('#save-draft').click();
    await page.waitForTimeout(400);
    const afterCount = await page.evaluate(() => window.__reputifly.getState().quotations.size);
    if (afterCount === beforeCount + 1) pass('saveQuotation increments count (' + beforeCount + ' -> ' + afterCount + ')');
    else fail('saveQuotation: ' + beforeCount + ' -> ' + afterCount);

    // 4. Quotation list + drawer
    console.log('\n[4] Quotation list + drawer');
    await page.evaluate(() => window.__reputifly.setRoute('quotations'));
    await page.waitForTimeout(200);
    const listRows = await page.locator('#quotations-list .list-row').count();
    if (listRows === afterCount) pass('list shows ' + listRows + ' rows');
    else fail('list shows ' + listRows + ', expected ' + afterCount);

    await page.locator('#quotations-list .list-row').first().click();
    await page.waitForTimeout(300);
    const drawerOpen = await page.evaluate(() => window.__reputifly.getState().drawer.open);
    if (drawerOpen) pass('drawer opens on row click');
    else fail('drawer did not open on row click');

    await page.locator('#drawer .input[data-key="name"]').fill('Drawer Edited Co');
    await page.locator('#drawer .btn.primary').click();
    await page.waitForTimeout(300);

    const updatedFound = await page.evaluate(() => {
      return Array.from(window.__reputifly.getState().quotations.values())
        .some(q => q.client && q.client.name === 'Drawer Edited Co');
    });
    if (updatedFound) pass('drawer save persists name change');
    else fail('drawer save did not persist');

    // 5. Search
    console.log('\n[5] Smart search');
    await page.locator('#search-quotations').fill('drawer');
    await page.waitForTimeout(300);
    const filtered = await page.locator('#quotations-list .list-row').count();
    if (filtered === 1) pass('search "drawer" -> 1 row');
    else fail('search "drawer" -> ' + filtered);

    await page.locator('#search-quotations').fill('');
    await page.waitForTimeout(250);

    // 6. Convert quotation -> invoice
    console.log('\n[6] Convert quotation -> invoice');
    const before = await page.evaluate(() => ({
      inv: window.__reputifly.getState().invoices.size,
      counter: window.__reputifly.getState().counters.invoice.value
    }));
    await page.evaluate(() => {
      const arr = Array.from(window.__reputifly.getState().quotations.values());
      const target = arr.find(q => q.status !== 'converted');
      window.__reputifly.openDrawer('quotation', target.id);
    });
    await page.waitForTimeout(300);
    await page.locator('#drawer-foot button:has-text("Mark as paid")').click();
    await page.waitForTimeout(250);
    await page.locator('#modal-card .btn.primary').click();
    await page.waitForTimeout(400);
    const afterC = await page.evaluate(() => ({
      inv: window.__reputifly.getState().invoices.size,
      counter: window.__reputifly.getState().counters.invoice.value
    }));
    if (afterC.inv === before.inv + 1 && afterC.counter === before.counter + 1) {
      pass('conversion: invoices ' + before.inv + ' -> ' + afterC.inv + ', counter ' + before.counter + ' -> ' + afterC.counter);
    } else {
      fail('conversion: invoices ' + before.inv + '->' + afterC.inv + ', counter ' + before.counter + '->' + afterC.counter);
    }

    await page.evaluate(() => {
      const c = document.getElementById('drawer-close');
      if (c) c.click();
    });

    // 7. Invoice numbering panel
    console.log('\n[7] Invoice numbering panel');
    await page.evaluate(() => window.__reputifly.setRoute('invoices'));
    await page.waitForTimeout(200);
    const npanel = await page.locator('.invoice-numbering-panel .ip-value').textContent();
    if (npanel && npanel.trim().startsWith('INV-')) pass('numbering panel: ' + npanel.trim());
    else fail('numbering panel value: "' + npanel + '"');

    // 8. Void invoice
    console.log('\n[8] Void invoice');
    await page.evaluate(() => {
      const arr = Array.from(window.__reputifly.getState().invoices.values());
      const target = arr.find(i => i.status !== 'void');
      window.__reputifly.openDrawer('invoice', target.id);
    });
    await page.waitForTimeout(300);
    await page.locator('#drawer-foot button:has-text("Void")').click();
    await page.waitForTimeout(200);
    await page.locator('#modal-card .btn.danger').click();
    await page.waitForTimeout(400);
    const voided = await page.evaluate(() => {
      return Array.from(window.__reputifly.getState().invoices.values()).some(i => i.status === 'void');
    });
    if (voided) pass('void invoice updated status');
    else fail('void invoice did not update status');

    await page.evaluate(() => {
      const c = document.getElementById('drawer-close');
      if (c) c.click();
    });

    // 9. Advanced terms
    console.log('\n[9] Advanced tab');
    await page.evaluate(() => window.__reputifly.setRoute('advanced'));
    await page.waitForTimeout(300);
    const sectionCards = await page.locator('.terms-section-card').count();
    if (sectionCards >= 5) pass('terms editor renders ' + sectionCards + ' sections');
    else fail('terms editor sections: ' + sectionCards);

    await page.locator('#add-section').click();
    await page.waitForTimeout(150);
    const cardsAfter = await page.locator('.terms-section-card').count();
    if (cardsAfter === sectionCards + 1) pass('add section works');
    else fail('add section: ' + sectionCards + ' -> ' + cardsAfter);

    await page.locator('.terms-section-card').last().locator('button.del').click();
    await page.waitForTimeout(150);

    await page.locator('input[data-cf="name"]').fill('Test Co Pte Ltd');
    await page.locator('#save-brand').click();
    await page.waitForTimeout(200);
    const newName = await page.evaluate(() => window.__reputifly.getState().settings.company.name);
    if (newName === 'Test Co Pte Ltd') pass('brand name save persists');
    else fail('brand name = "' + newName + '"');

    // 10. PDF render
    console.log('\n[10] PDF render');
    await page.evaluate(async () => {
      const data = Array.from(window.__reputifly.getState().invoices.values())[0];
      await window.__reputifly.downloadPdf(data, 'invoice');
    });
    await page.waitForTimeout(400);
    const iframeOK = await page.evaluate(() => {
      const f = document.getElementById('print-iframe');
      return !!(f.contentDocument && f.contentDocument.querySelector('.page'));
    });
    if (iframeOK) pass('PDF iframe contains rendered .page');
    else fail('PDF iframe is empty');

    await page.evaluate(async () => {
      const data = Array.from(window.__reputifly.getState().invoices.values())[0];
      data.terms = window.__reputifly.getState().settings.defaultTerms;
      await window.__reputifly.downloadPdf(data, 'invoice-with-terms');
    });
    await page.waitForTimeout(400);
    const pageCount = await page.evaluate(() => {
      const f = document.getElementById('print-iframe');
      return f.contentDocument ? f.contentDocument.querySelectorAll('.page').length : 0;
    });
    if (pageCount === 2) pass('PDF with-terms iframe contains 2 pages');
    else fail('PDF with-terms page count = ' + pageCount);

    // 11. Mobile breakpoints
    console.log('\n[11] Mobile responsive');
    const m = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mp = await m.newPage();
    await mp.goto('http://127.0.0.1:' + PORT + '/index.html?dev=1');
    await mp.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await mp.waitForTimeout(500);
    const tabsHidden = await mp.locator('.tabs').isHidden();
    const dropdownVisible = await mp.locator('#tab-dropdown').isVisible();
    if (tabsHidden && dropdownVisible) pass('mobile uses dropdown nav');
    else fail('mobile tabs: hidden=' + tabsHidden + ', dropdownVisible=' + dropdownVisible);

    await mp.locator('#tab-dropdown-trigger').click();
    await mp.waitForTimeout(150);
    await mp.locator('.tab-dropdown-item[data-route="invoices"]').click();
    await mp.waitForTimeout(200);
    const route = await mp.evaluate(() => window.__reputifly.getState().route);
    if (route === 'invoices') pass('mobile dropdown selection switches route');
    else fail('route after dropdown click: ' + route);

    await mp.evaluate(() => window.__reputifly.setRoute('creation'));
    await mp.waitForTimeout(400);
    // On mobile we use the form-based editor (m-card layout). Check that and
    // fall back to .editor-page for any other viewports that hit this path.
    const overflow = await mp.evaluate(() => {
      const e = document.querySelector('.m-card') || document.querySelector('.editor-page');
      if (!e) return null;
      return { scrollWidth: e.scrollWidth, clientWidth: e.clientWidth };
    });
    if (overflow && overflow.scrollWidth <= overflow.clientWidth + 1) {
      pass('mobile editor fits viewport (sw=' + overflow.scrollWidth + ', cw=' + overflow.clientWidth + ')');
    } else {
      fail('mobile editor overflow: ' + JSON.stringify(overflow));
    }
    // Confirm form-based mobile editor is rendering (not WYSIWYG)
    const isFormBased = await mp.evaluate(() => !!document.querySelector('.m-card'));
    if (isFormBased) pass('mobile creation uses form-based editor');
    else fail('mobile creation should use form-based editor');

    // body level
    const bodyOverflow = await mp.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth
    }));
    if (bodyOverflow.sw <= bodyOverflow.cw + 1) pass('mobile body has no horizontal overflow');
    else fail('mobile body overflow: ' + JSON.stringify(bodyOverflow));

    await mp.screenshot({ path: path.join(PROJECT_DIR, 'spa-verify-mobile-creation-fixed.png'), fullPage: true });
    pass('mobile post-fix screenshot saved');

    // 12. Errors check
    console.log('\n[12] Console errors');
    if (errors.length === 0) pass('no JS page errors');
    else fail('captured ' + errors.length + ' errors: ' + errors.slice(0, 3).join('; '));

  } catch (e) {
    console.error('AUDIT CRASHED:', e);
    failures++;
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures ? 'X ' + failures + ' audit failure(s)' : 'OK All audit checks passed'));
  process.exit(failures ? 1 : 0);
})();
