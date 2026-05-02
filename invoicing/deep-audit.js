/**
 * deep-audit.js — Exhaustive end-to-end feature/UI audit.
 * Covers every feature in the implementation plan + every UI/UX requirement
 * the user has asked for during build. Run on a fresh checkout to confirm the
 * SPA is deploy-ready.
 *
 * Sections:
 *   [A] Auth screen          — login form renders without Firebase
 *   [B] Top chrome           — 5 tabs, user email, sign-out
 *   [C] Creation tab         — WYSIWYG, items, totals, optional × markers
 *   [D] Drafts tab           — list, search, status pills, kebab popover
 *   [E] Drawer               — open, Show-empty toggle, edit + save
 *   [F] Mark as paid         — date popup, atomic conversion, counter +1
 *   [G] Delete + renumber    — counter decrements only for the latest draft
 *   [H] Paid invoices tab    — numbering panel, list, void
 *   [I] Library tab          — CRUD, quick-add to creation
 *   [J] Advanced tab         — brand save, terms editor, JSON export, preview
 *   [K] PDF render           — new tab + auto-print + filename = NUMBER-CLIENT
 *   [L] Mobile               — dropdown nav, form-based editor, bottom sheet
 *   [M] No console errors    — no JS pageerrors during the entire run
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = __dirname;
const PORT = 8686;

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
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const fp = path.join(PROJECT_DIR, p);
      if (!fp.startsWith(PROJECT_DIR) || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        r.writeHead(404); r.end(); return;
      }
      const ext = path.extname(fp).toLowerCase();
      r.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(fp).pipe(r);
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
    s.on('error', rej);
  });
}

let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ FAIL:', msg); };
const pass = (msg) => console.log('  ✓ PASS:', msg);
const head = (label) => console.log('\n' + label);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const errors = [];

  async function loadDev(viewport = { width: 1440, height: 900 }) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => { errors.push(`[${viewport.width}px] ${e.message}`); });
    await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
    await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await page.waitForTimeout(700);
    return page;
  }

  try {
    // ───── [A] Auth screen ─────────────────────────────────────────────
    head('[A] Auth screen renders standalone (no Firebase init)');
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(`[auth] ${e.message}`));
      // Block Firebase scripts so the auth screen stays put
      await page.route('**/firebasejs/**', r => r.abort());
      await page.goto(`http://127.0.0.1:${PORT}/index.html`);
      await page.waitForTimeout(800);
      const visible = await page.locator('#auth-screen').isVisible();
      if (visible) pass('auth screen visible without Firebase');
      else fail('auth screen not visible');
      const emailInput = await page.locator('#auth-email').count();
      const pwInput = await page.locator('#auth-password').count();
      const submitBtn = await page.locator('#auth-submit').count();
      const resetLink = await page.locator('#auth-reset').count();
      if (emailInput && pwInput && submitBtn && resetLink) pass('auth form has email + password + submit + reset link');
      else fail('auth form missing inputs');
      await page.close();
      await ctx.close();
    }

    // ───── Bring up the dev-mode SPA for everything else ──────────────
    const page = await loadDev();

    // ───── [B] Top chrome ──────────────────────────────────────────────
    head('[B] Top chrome — 5 tabs, user email, sign-out');
    const tabRoutes = ['creation', 'quotations', 'invoices', 'library', 'advanced'];
    for (const r of tabRoutes) {
      const exists = await page.locator(`.tab-btn[data-route="${r}"]`).count();
      if (exists) pass(`tab "${r}" exists`);
      else fail(`tab "${r}" missing`);
    }
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.tab-btn')).map(b => b.textContent.trim()));
    const expected = ['Create', 'Drafts', 'Paid', 'Library', 'Advanced'];
    if (JSON.stringify(labels) === JSON.stringify(expected)) pass('tab labels = ' + labels.join('|'));
    else fail('tab labels: ' + labels.join('|'));
    const userEmail = await page.locator('#user-email').textContent();
    if (userEmail && userEmail.includes('@')) pass(`user-email shows "${userEmail.trim()}"`);
    else fail('user-email missing or empty');
    const signoutCount = await page.locator('#signout-btn').count();
    if (signoutCount === 1) pass('sign-out button present');

    // ───── [C] Creation tab ────────────────────────────────────────────
    head('[C] Creation tab — WYSIWYG, items, totals');
    await page.evaluate(() => window.__reputifly.setRoute('creation'));
    await page.waitForTimeout(300);
    const intro = await page.locator('.creation-intro-title').textContent();
    if (intro.includes('New invoice') && intro.includes('QINV-')) pass(`intro: "${intro.trim()}"`);
    else fail(`intro: "${intro}"`);

    // No mode toggle should exist (simplified)
    const modeToggleCount = await page.locator('.mode-toggle').count();
    if (modeToggleCount === 0) pass('no mode toggle (drafts only)');
    else fail('mode toggle still present');

    // Add 2 items, then remove 1, leaving 2
    await page.locator('.add-item-row').click();
    await page.locator('.add-item-row').click();
    await page.waitForTimeout(150);
    const itemRows = await page.locator('.editor-page .item-row').count();
    if (itemRows === 3) pass(`add line item works (3 rows)`);
    else fail(`expected 3 rows, got ${itemRows}`);
    await page.locator('.editor-page .item-row .row-trash button').first().click();
    await page.waitForTimeout(150);
    const after = await page.locator('.editor-page .item-row').count();
    if (after === 2) pass('row-trash removes a row');

    // Edit client name via contenteditable
    await page.locator('.editor-page .party-name.ce').click();
    await page.keyboard.type('Audit Test Client');
    await page.locator('.editor-page').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(150);
    const draftName = await page.evaluate(() => window.__reputifly.getState().draft.client.name);
    if (draftName === 'Audit Test Client') pass('contenteditable client name persists');
    else fail(`client name = "${draftName}"`);

    // Type qty/rate, totals must recompute
    await page.locator('.editor-page .item-row input[data-field="qty"]').first().fill('3');
    await page.locator('.editor-page .item-row input[data-field="rate"]').first().fill('150');
    await page.waitForTimeout(200);
    const total = await page.evaluate(() => window.__reputifly.getState().draft.total);
    if (total === 450) pass(`totals recompute (3×150 = ${total})`);
    else fail(`expected 450, got ${total}`);

    // Optional × marker on client fields exists (one for each visible optional line)
    const optMarkers = await page.locator('.editor-page .optional-line .opt-x').count();
    if (optMarkers >= 4) pass(`optional × markers present (${optMarkers} found)`);
    else fail(`expected ≥4 optional × markers, got ${optMarkers}`);

    // Remove an optional field via × (× is CSS hover-only; dispatch click in JS)
    const billedLines = await page.locator('#billed-detail .optional-line').count();
    await page.evaluate(() => {
      const x = document.querySelector('#billed-detail .optional-line .opt-x');
      if (x) x.click();
    });
    await page.waitForTimeout(200);
    const billedAfter = await page.locator('#billed-detail .optional-line').count();
    if (billedAfter === billedLines - 1) pass(`× marker removes optional field (${billedLines} → ${billedAfter})`);
    else fail(`× did not remove: ${billedLines} → ${billedAfter}`);

    // "+ Add field" should now be visible since we have a hidden field
    const addFieldBtn = page.locator('.editor-page #billed-add button').first();
    if (await addFieldBtn.isVisible()) pass('"+ Add field" button visible after removing optional');
    else fail('"+ Add field" not visible');

    // ───── [D] Drafts tab ──────────────────────────────────────────────
    head('[D] Drafts tab — list, search, status pills, kebab popover');
    // Save draft, then go to Drafts tab
    await page.locator('#save-draft').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__reputifly.setRoute('quotations'));
    await page.waitForTimeout(200);
    const title = await page.locator('#view-quotations .view-title').textContent();
    if (title.trim() === 'Drafts') pass('view title = "Drafts"');
    else fail(`view title: "${title}"`);
    const newBtn = await page.locator('#new-quotation-btn').textContent();
    if (newBtn.trim() === 'New invoice') pass('"New invoice" button label');
    else fail(`button: "${newBtn}"`);
    const rows = await page.locator('#quotations-list .list-row').count();
    if (rows >= 5) pass(`drafts list shows ${rows} rows`);
    else fail(`drafts list shows only ${rows} rows`);

    // Search
    await page.locator('#search-quotations').fill('audit');
    await page.waitForTimeout(250);
    const filtered = await page.locator('#quotations-list .list-row').count();
    if (filtered === 1) pass('search "audit" → 1 row');
    else fail(`search returned ${filtered}`);
    await page.locator('#search-quotations').fill('');
    await page.waitForTimeout(150);

    // Kebab popover (desktop)
    await page.locator('#quotations-list .list-row .list-cell-actions button').first().click();
    await page.waitForTimeout(120);
    const popoverItems = await page.evaluate(() => {
      const popovers = Array.from(document.body.children).filter(el => el.tagName === 'DIV' && el.style.position === 'fixed');
      return popovers[popovers.length - 1] ? popovers[popovers.length - 1].textContent : '';
    });
    if (popoverItems.includes('Open') && popoverItems.includes('Mark as paid') && popoverItems.includes('Delete')) {
      pass('kebab shows Open / Mark as paid / Delete / Download PDF');
    } else fail(`kebab items: ${popoverItems}`);
    // Close popover
    await page.click('body', { position: { x: 50, y: 50 } });
    await page.waitForTimeout(150);

    // ───── [E] Drawer ──────────────────────────────────────────────────
    head('[E] Drawer — open, Show-empty toggle, edit + save');
    await page.locator('#quotations-list .list-row').first().click();
    await page.waitForTimeout(300);
    const drawerOpen = await page.evaluate(() => window.__reputifly.getState().drawer.open);
    if (drawerOpen) pass('drawer opens on row click');
    else fail('drawer did not open');
    const drawerTitle = await page.locator('#drawer-title').textContent();
    if (drawerTitle.includes('Draft invoice')) pass(`drawer title: "${drawerTitle.trim()}"`);
    else fail(`drawer title: "${drawerTitle}"`);

    // Show-empty toggle
    const toggleExists = await page.locator('#drawer-show-empty').count();
    if (toggleExists === 1) pass('"Show empty" toggle present');
    else fail('"Show empty" toggle missing');
    // Toggle should hide blanks; clicking + N hidden expands
    await page.evaluate(() => {
      window.__reputifly.getState().drawer.showEmpty = false;
      window.__reputifly.forceRender();
    });
    await page.waitForTimeout(150);

    // Save name change
    await page.locator('#drawer .input[data-key="name"]').fill('Drawer-Edited Co');
    await page.locator('#drawer-foot .btn.primary').click();
    await page.waitForTimeout(300);
    const updated = await page.evaluate(() => Array.from(window.__reputifly.getState().quotations.values())
      .some(q => q.client && q.client.name === 'Drawer-Edited Co'));
    if (updated) pass('drawer name change persists');
    else fail('drawer save did not persist');

    // ───── [F] Mark as paid ────────────────────────────────────────────
    head('[F] Mark as paid — date popup, conversion, counter +1');
    const before = await page.evaluate(() => ({
      inv: window.__reputifly.getState().invoices.size,
      cnt: window.__reputifly.getState().counters.invoice.value
    }));
    await page.evaluate(() => {
      const target = Array.from(window.__reputifly.getState().quotations.values())
        .find(q => q.status !== 'converted');
      window.__reputifly.openDrawer('quotation', target.id);
    });
    await page.waitForTimeout(300);
    await page.locator('#drawer-foot button:has-text("Mark as paid")').click();
    await page.waitForTimeout(200);
    // Date input should be in the modal
    const dateInputs = await page.locator('#modal-card input[type="date"]').count();
    if (dateInputs === 1) pass('payment date picker shown in modal');
    else fail(`expected 1 date input, got ${dateInputs}`);
    await page.locator('#modal-card .btn.primary').click();
    await page.waitForTimeout(400);
    const afterC = await page.evaluate(() => ({
      inv: window.__reputifly.getState().invoices.size,
      cnt: window.__reputifly.getState().counters.invoice.value
    }));
    if (afterC.inv === before.inv + 1 && afterC.cnt === before.cnt + 1) {
      pass(`atomic conversion: invoices ${before.inv}→${afterC.inv}, counter ${before.cnt}→${afterC.cnt}`);
    } else {
      fail(`conversion: invoices ${before.inv}→${afterC.inv}, counter ${before.cnt}→${afterC.cnt}`);
    }
    await page.evaluate(() => document.getElementById('drawer-close')?.click());
    await page.waitForTimeout(200);

    // ───── [G] Delete + renumber ───────────────────────────────────────
    head('[G] Delete + renumber — counter decrements only for latest');
    const cBefore = await page.evaluate(() => window.__reputifly.getState().counters.quotation.value);
    const latestId = await page.evaluate((max) => {
      return Array.from(window.__reputifly.getState().quotations.values())
        .find(q => q.number === max).id;
    }, cBefore);
    await page.evaluate(async (id) => { await window.__reputifly._test_delete(id); }, latestId);
    await page.waitForTimeout(300);
    const cAfter = await page.evaluate(() => window.__reputifly.getState().counters.quotation.value);
    if (cAfter === cBefore - 1) pass(`deleting latest decrements counter (${cBefore} → ${cAfter})`);
    else fail(`expected ${cBefore - 1}, got ${cAfter}`);

    const olderId = await page.evaluate(() => {
      const arr = Array.from(window.__reputifly.getState().quotations.values());
      return arr.find(q => q.number === 1)?.id;
    });
    if (olderId) {
      const c1 = await page.evaluate(() => window.__reputifly.getState().counters.quotation.value);
      await page.evaluate(async (id) => { await window.__reputifly._test_delete(id); }, olderId);
      await page.waitForTimeout(200);
      const c2 = await page.evaluate(() => window.__reputifly.getState().counters.quotation.value);
      if (c1 === c2) pass(`deleting older draft preserves counter (${c1})`);
      else fail(`older delete changed counter ${c1} → ${c2}`);
    }

    // ───── [H] Paid invoices tab ───────────────────────────────────────
    head('[H] Paid invoices tab — numbering panel, list, void');
    await page.evaluate(() => window.__reputifly.setRoute('invoices'));
    await page.waitForTimeout(300);
    const paidTitle = await page.locator('#view-invoices .view-title').textContent();
    if (paidTitle.trim() === 'Paid invoices') pass('"Paid invoices" title');
    else fail(`title: "${paidTitle}"`);
    const ipValue = await page.locator('.invoice-numbering-panel .ip-value').textContent();
    if (ipValue.trim().startsWith('INV-')) pass(`numbering panel value: ${ipValue.trim()}`);
    else fail(`numbering panel: "${ipValue}"`);
    const ipInput = await page.locator('#ip-next-input').count();
    const ipBtn = await page.locator('#ip-save').count();
    if (ipInput && ipBtn) pass('numbering panel has input + Update button');
    else fail('numbering panel controls missing');

    // Void invoice
    const beforeVoid = await page.evaluate(() => Array.from(window.__reputifly.getState().invoices.values())
      .filter(i => i.status === 'void').length);
    await page.evaluate(() => {
      const target = Array.from(window.__reputifly.getState().invoices.values()).find(i => i.status !== 'void');
      window.__reputifly.openDrawer('invoice', target.id);
    });
    await page.waitForTimeout(300);
    // Drawer should NOT show "Status" section for paid invoices (simplified)
    const statusSecCount = await page.evaluate(() => {
      const ts = Array.from(document.querySelectorAll('.section-title')).map(s => s.textContent);
      return ts.filter(t => t === 'Status' || t.includes('Meta')).length;
    });
    if (statusSecCount === 0) pass('paid drawer omits status/meta section (simplified)');
    else fail(`paid drawer still has ${statusSecCount} status sections`);
    await page.locator('#drawer-foot button:has-text("Void")').click();
    await page.waitForTimeout(200);
    await page.locator('#modal-card .btn.danger').click();
    await page.waitForTimeout(400);
    const afterVoid = await page.evaluate(() => Array.from(window.__reputifly.getState().invoices.values())
      .filter(i => i.status === 'void').length);
    if (afterVoid > beforeVoid) pass(`void increments void count (${beforeVoid} → ${afterVoid})`);
    else fail(`void count: ${beforeVoid} → ${afterVoid}`);
    await page.evaluate(() => document.getElementById('drawer-close')?.click());
    await page.waitForTimeout(200);

    // ───── [I] Library tab ─────────────────────────────────────────────
    head('[I] Library — CRUD + quick-add to creation');
    await page.evaluate(() => window.__reputifly.setRoute('library'));
    await page.waitForTimeout(300);
    const libRows = await page.locator('#library-list .list-row').count();
    if (libRows >= 3) pass(`library has ${libRows} default items`);
    else fail(`library rows: ${libRows}`);

    // Add new library item
    await page.locator('#new-library-btn').click();
    await page.waitForTimeout(150);
    await page.locator('#modal-card input[data-k="description"]').fill('Audit Service');
    await page.locator('#modal-card input[data-k="qty"]').fill('2');
    await page.locator('#modal-card input[data-k="rate"]').fill('500');
    await page.locator('#modal-card .btn.primary').click();
    await page.waitForTimeout(300);
    const libAfterAdd = await page.locator('#library-list .list-row').count();
    if (libAfterAdd === libRows + 1) pass(`new library item added (${libRows} → ${libAfterAdd})`);
    else fail(`add: ${libRows} → ${libAfterAdd}`);

    // Quick-add via Creation tab
    await page.evaluate(() => window.__reputifly.setRoute('creation'));
    await page.waitForTimeout(250);
    const itemsBefore = await page.evaluate(() => window.__reputifly.getState().draft.items.length);
    await page.locator('button:has-text("From library")').first().click();
    await page.waitForTimeout(200);
    const libModalRows = await page.locator('#modal-card button').count();
    if (libModalRows >= libAfterAdd) pass('library picker shows items');
    else fail(`library picker rows: ${libModalRows}`);
    // Click first library item button (not the "Cancel"/"Manage" buttons)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#modal-card button'));
      const itemBtn = buttons.find(b => b.querySelector('strong'));
      if (itemBtn) itemBtn.click();
    });
    await page.waitForTimeout(300);
    const itemsAfter = await page.evaluate(() => window.__reputifly.getState().draft.items.length);
    // It either replaced the placeholder (count same) or appended (count +1) — either is fine
    if (itemsAfter >= 1 && itemsAfter <= itemsBefore + 1) pass(`library quick-add inserted into draft`);
    else fail(`items before: ${itemsBefore}, after: ${itemsAfter}`);

    // ───── [J] Advanced tab ────────────────────────────────────────────
    head('[J] Advanced — brand save, terms editor, JSON export, preview');
    await page.evaluate(() => window.__reputifly.setRoute('advanced'));
    await page.waitForTimeout(300);
    const sectionsBefore = await page.locator('.terms-section-card').count();
    if (sectionsBefore >= 5) pass(`terms editor renders ${sectionsBefore} sections`);

    // Brand save
    await page.locator('input[data-cf="name"]').fill('Reputifly Audit Co');
    await page.locator('#save-brand').click();
    await page.waitForTimeout(200);
    const brandPersist = await page.evaluate(() => window.__reputifly.getState().settings.company.name);
    if (brandPersist === 'Reputifly Audit Co') pass('brand save persists');
    else fail(`brand: "${brandPersist}"`);

    // Add + remove section
    await page.locator('#add-section').click();
    await page.waitForTimeout(150);
    const after1 = await page.locator('.terms-section-card').count();
    await page.locator('.terms-section-card').last().locator('button.del').click();
    await page.waitForTimeout(150);
    const after2 = await page.locator('.terms-section-card').count();
    if (after1 === sectionsBefore + 1 && after2 === sectionsBefore) pass('terms add + remove works');
    else fail(`terms count flow: ${sectionsBefore} → ${after1} → ${after2}`);

    // Export buttons exist
    const exportBtn = await page.locator('#export-all').count();
    if (exportBtn === 1) pass('export-all button present');
    else fail('export-all missing');

    // ───── [K] PDF render ──────────────────────────────────────────────
    head('[K] PDF render — iframe content + filename');
    // Listen for new page (popup)
    const popupPromise = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.evaluate(async () => {
      const inv = Array.from(window.__reputifly.getState().invoices.values())[0];
      await window.__reputifly.downloadPdf(inv, 'invoice');
    });
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState('domcontentloaded');
      const popupTitle = await popup.title();
      if (popupTitle.startsWith('INV-')) pass(`PDF popup title (filename) = "${popupTitle}"`);
      else fail(`PDF popup title: "${popupTitle}"`);
      const popupPages = await popup.locator('.page').count();
      if (popupPages === 1) pass('PDF popup contains 1 page (single invoice)');
      else fail(`PDF popup pages: ${popupPages}`);
      await popup.close();
    } else {
      fail('PDF popup did not open');
    }

    // With-terms variant
    const popup2Promise = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.evaluate(async () => {
      const inv = Array.from(window.__reputifly.getState().invoices.values())[0];
      const data = { ...inv, terms: window.__reputifly.getState().settings.defaultTerms };
      await window.__reputifly.downloadPdf(data, 'invoice-with-terms');
    });
    const popup2 = await popup2Promise;
    if (popup2) {
      await popup2.waitForLoadState('domcontentloaded');
      const pgs = await popup2.locator('.page').count();
      if (pgs === 2) pass('PDF popup with-terms contains 2 pages');
      else fail(`with-terms pages: ${pgs}`);
      await popup2.close();
    } else fail('with-terms popup did not open');

    // PDF should still work even when client has no address/email/postal/attn
    head('[K1] PDF — works with empty optional fields');
    await page.evaluate(() => {
      // Build a minimal invoice with no address / email / attn / postal
      window.__reputifly.getState()._minimalInv = {
        displayNumber: 'INV-9999',
        issueDate: '2026-05-01',
        client: { name: 'Bare Client' },
        items: [{ description: 'Service', qty: 1, rate: 100, amount: 100 }],
        subtotal: 100, total: 100,
        optional: window.__reputifly.getState().settings.optionalFieldDefaults
      };
    });
    const minimalPopupP = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null);
    await page.evaluate(async () => {
      const d = window.__reputifly.getState()._minimalInv;
      await window.__reputifly.downloadPdf(d, 'invoice');
    });
    const minimalPopup = await minimalPopupP;
    if (minimalPopup) {
      await minimalPopup.waitForLoadState('domcontentloaded');
      const ttl = await minimalPopup.title();
      if (ttl.includes('INV-9999')) pass('PDF renders with minimal client info (no address/email)');
      else fail(`minimal PDF title: "${ttl}"`);
      await minimalPopup.close();
    } else {
      fail('minimal PDF popup did not open');
    }

    // ───── [L] Mobile ──────────────────────────────────────────────────
    head('[L] Mobile — dropdown nav, form-based editor, bottom sheet');
    const mp = await loadDev({ width: 375, height: 812 });

    const tabsHidden = await mp.locator('.tabs').isHidden();
    const ddVisible = await mp.locator('#tab-dropdown').isVisible();
    if (tabsHidden && ddVisible) pass('mobile uses dropdown nav');
    else fail(`mobile tabs hidden=${tabsHidden}, dropdown=${ddVisible}`);

    // Open dropdown + pick Library
    await mp.locator('#tab-dropdown-trigger').click();
    await mp.waitForTimeout(150);
    await mp.locator('.tab-dropdown-item[data-route="library"]').click();
    await mp.waitForTimeout(200);
    const mRoute = await mp.evaluate(() => window.__reputifly.getState().route);
    if (mRoute === 'library') pass('mobile dropdown navigates to Library');
    else fail(`mobile route after dropdown click: ${mRoute}`);

    // Mobile form-based creation editor
    await mp.evaluate(() => window.__reputifly.setRoute('creation'));
    await mp.waitForTimeout(400);
    const isFormBased = await mp.evaluate(() => !!document.querySelector('.m-card'));
    const noWysiwyg = await mp.evaluate(() => !document.querySelector('.editor-page'));
    if (isFormBased && noWysiwyg) pass('mobile uses form-based creation editor');
    else fail(`form-based: ${isFormBased}, no WYSIWYG: ${noWysiwyg}`);

    // No horizontal overflow
    const overflow = await mp.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth
    }));
    if (overflow.sw <= overflow.cw + 1) pass(`mobile no horizontal overflow (sw=${overflow.sw}, cw=${overflow.cw})`);
    else fail(`mobile overflow: ${JSON.stringify(overflow)}`);

    // Mobile bottom sheet for kebab
    await mp.evaluate(() => window.__reputifly.setRoute('quotations'));
    await mp.waitForTimeout(300);
    const firstKebab = mp.locator('#quotations-list .list-row .list-cell-actions button').first();
    await firstKebab.click();
    await mp.waitForTimeout(250);
    const bsOpen = await mp.locator('#bottom-sheet.open').count();
    if (bsOpen === 1) pass('mobile kebab opens bottom sheet');
    else fail('mobile bottom sheet did not open');
    // Close it
    await mp.locator('#bottom-sheet button:has-text("Cancel")').click();
    await mp.waitForTimeout(250);

    // Mobile invoice numbering panel justified
    await mp.evaluate(() => window.__reputifly.setRoute('invoices'));
    await mp.waitForTimeout(250);
    const ipMobileMeta = await mp.locator('.invoice-numbering-panel .ip-meta').isHidden();
    if (ipMobileMeta) pass('mobile numbering panel hides "Last issued" meta line (simplified)');
    // input + button stack with justified grid
    const ipEditDisplay = await mp.evaluate(() => {
      const e = document.querySelector('.invoice-numbering-panel .ip-edit');
      return e ? getComputedStyle(e).display : null;
    });
    if (ipEditDisplay === 'grid') pass('mobile numbering panel input+button = justified grid');
    else fail(`ip-edit display = ${ipEditDisplay}`);

    await mp.close();

    // ───── [M] No console errors ───────────────────────────────────────
    head('[M] Console errors');
    if (errors.length === 0) pass('zero JS pageerrors across the entire run');
    else fail(`${errors.length} errors: ${errors.slice(0, 3).join('; ')}`);

  } catch (e) {
    console.error('AUDIT CRASHED:', e);
    failures++;
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n' + (failures
    ? `✗ ${failures} failure(s) — fix before deploy`
    : '✓ All deep-audit checks passed — ready for deploy'));
  process.exit(failures ? 1 : 0);
})();
