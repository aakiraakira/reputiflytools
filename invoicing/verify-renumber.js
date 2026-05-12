// verify-renumber.js
// End-to-end check that the payment-date-driven renumber produces the
// exact order the user expects.
//
// Scenario replicates the screenshot in the bug report:
//   Original counter: 8507 (so "next" = INV-8508).
//   8 paid invoices, numbered 8500..8507 in the order they were
//   originally marked-as-paid (createdAt ascending matches the
//   original number ascending).
//   But their PAYMENT dates are out of order — Ancient Spa (12 May)
//   sits between two 10-May invoices and a 9-May invoice. The bank
//   statement reads chronologically; the dashboard should too.
//
// Expected result after renumber:
//   INV-8500  Gavan Homes              07 May
//   INV-8501  GenTech Services         07 May
//   INV-8502  The Purposeful Company   08 May
//   INV-8503  Eben Solutions           09 May
//   INV-8504  New Days Consultancy     10 May  (tie-break: created earlier)
//   INV-8505  Eugene Chieng            10 May
//   INV-8506  Ancient Dynasty Spa 2    12 May  (tie-break: created earlier)
//   INV-8507  DS Flooring Solutions    12 May

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8492;
const PROJECT_DIR = __dirname;
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css',   '.json': 'application/json',
  '.png': 'image/png',  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'
};

function startServer() {
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const fp = path.join(PROJECT_DIR, p);
      if (!fp.startsWith(PROJECT_DIR) || !fs.existsSync(fp)) { r.writeHead(404); r.end(); return; }
      const ext = path.extname(fp).toLowerCase();
      r.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      fs.createReadStream(fp).pipe(r);
    });
    s.listen(PORT, '127.0.0.1', () => res(s));
  });
}

let failed = 0;
const fail  = (m) => { failed++; console.error('  FAIL:', m); };
const pass  = (m) => console.log('  PASS:', m);
const eq    = (a, b, m) => (a === b ? pass(m) : fail(`${m}  got=${JSON.stringify(a)}  want=${JSON.stringify(b)}`));

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => { failed++; console.error('  pageerror:', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(300);

  // ── SEED the scenario ─────────────────────────────────────────────
  // 8 invoices, numbered 8500..8507 in original-conversion order
  // (createdAt ascending matches number ascending). Payment dates
  // intentionally out-of-order.
  //
  // The original-conversion order matches the user's screenshot:
  //   8500 Gavan (7 May)
  //   8501 GenTech (7 May)        ← created right after Gavan
  //   8502 Purposeful (8 May)
  //   8503 Eben (9 May)
  //   8504 Ancient Spa (12 May)   ← payment was 12 May but was the
  //                                  first 12-May payment marked paid
  //   8505 New Days (10 May)      ← bug: lower date than 8504
  //   8506 Eugene (10 May)
  //   8507 DS Flooring (12 May)
  await page.evaluate(() => {
    const r = window.__reputifly;
    const s = r.getState();
    s.invoices.clear();
    s.counters.invoice = { value: 8507, prefix: 'INV-', padding: 4 };

    const seed = [
      // id,         num,   client name,                       paymentDate, createdAtSeconds
      ['gavan',      8500, 'Gavan Homes',                      '2026-05-07', 1000],
      ['gentech',    8501, 'GenTech Services and Supplies',    '2026-05-07', 1001],
      ['purposeful', 8502, 'The Purposeful Company Pte Ltd',   '2026-05-08', 1002],
      ['eben',       8503, 'Eben Solutions Pte Ltd',           '2026-05-09', 1003],
      ['ancient',    8504, 'Ancient Dynasty Spa 2 Pte Ltd',    '2026-05-12', 1004],
      ['newdays',    8505, 'New Days Consultancy',             '2026-05-10', 1005],
      ['eugene',     8506, 'Eugene Chieng',                    '2026-05-10', 1006],
      ['dsfloor',    8507, 'DS Flooring Solutions Pte Ltd',    '2026-05-12', 1007],
    ];
    for (const [id, num, name, date, ct] of seed) {
      s.invoices.set(id, {
        id, version: 1, number: num,
        displayNumber: 'INV-' + String(num).padStart(4, '0'),
        status: 'paid',
        issueDate: date,
        client: { name },
        items:  [{ description: 'Service', qty: 1, rate: 100, amount: 100 }],
        subtotal: 100, total: 100,
        createdAt: { seconds: ct }
      });
    }
    r.forceRender();
  });

  console.log('\n[1] BEFORE renumber — verify detection');
  const beforeOutOfOrder = await page.evaluate(() => window.__reputifly._test_detectOutOfOrder());
  eq(beforeOutOfOrder, true, 'detectInvoiceOrderingMismatch() returns true for screenshot scenario');

  console.log('\n[2] Run renumber');
  const result = await page.evaluate(async () => window.__reputifly._test_renumber());
  console.log('  changed =', result.changed);
  eq(typeof result.changed, 'number', 'renumber returns a {changed} count');
  if (result.changed === 0) fail('Expected at least some invoices to be renumbered');

  console.log('\n[3] AFTER renumber — verify each invoice');
  const after = await page.evaluate(() => {
    const s = window.__reputifly.getState();
    const m = {};
    for (const [k, v] of s.invoices) m[k] = { number: v.number, displayNumber: v.displayNumber, issueDate: v.issueDate };
    return m;
  });
  // Expected mapping (id → expected number)
  const expected = {
    gavan:      8500,
    gentech:    8501,
    purposeful: 8502,
    eben:       8503,
    newdays:    8504,
    eugene:     8505,
    ancient:    8506,
    dsfloor:    8507,
  };
  for (const [id, want] of Object.entries(expected)) {
    eq(after[id].number, want, `${id}.number === ${want}`);
    eq(after[id].displayNumber, 'INV-' + want, `${id}.displayNumber === INV-${want}`);
  }

  console.log('\n[4] AFTER renumber — verify dashboard order (top-down: latest payment first)');
  // Trigger renderList and read the rendered rows.
  await page.evaluate(() => window.__reputifly.setRoute('invoices'));
  await page.waitForTimeout(200);
  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#invoices-list .list-row')).map(row => ({
      number: row.querySelector('.list-cell-num span')?.textContent.trim(),
      client: row.querySelector('.client-name')?.textContent.trim(),
      date:   row.querySelector('.list-cell-date')?.textContent.trim()
    }));
  });
  console.log('  Rendered order:');
  rows.forEach((r, i) => console.log(`    ${i+1}. ${r.number}  ${r.client}  ${r.date}`));

  const orderById = ['dsfloor', 'ancient', 'eugene', 'newdays', 'eben', 'purposeful', 'gentech', 'gavan'];
  const expectedNums = orderById.map(id => 'INV-' + expected[id]);
  eq(JSON.stringify(rows.map(r => r.number)), JSON.stringify(expectedNums),
     'Dashboard renders newest payment date at top, INV-numbers descend');

  console.log('\n[5] Verify the "Payment Made" column header');
  const headerCells = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#invoices-list .list-head span')).map(s => s.textContent);
  });
  console.log('  Header cells:', headerCells);
  eq(headerCells.includes('Payment Made'), true, 'Invoices list header includes "Payment Made"');
  eq(headerCells.includes('Issued'), false, 'Invoices list header does NOT include "Issued"');

  console.log('\n[6] Verify page title says "Paid Invoices" (capital I)');
  const title = await page.evaluate(() => document.querySelector('#view-invoices .view-title')?.textContent);
  eq(title, 'Paid Invoices', 'Title is "Paid Invoices" with capital I');

  console.log('\n[7] Verify quotations tab still says "Issued"');
  await page.evaluate(() => window.__reputifly.setRoute('quotations'));
  await page.waitForTimeout(200);
  const qHeaderCells = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('#quotations-list .list-head span')).map(s => s.textContent);
  });
  eq(qHeaderCells.includes('Issued'), true, 'Quotations list header still uses "Issued"');
  eq(qHeaderCells.includes('Payment Made'), false, 'Quotations list does NOT show "Payment Made"');

  console.log('\n[8] Verify post-renumber ordering check returns false (already aligned)');
  const afterOutOfOrder = await page.evaluate(() => window.__reputifly._test_detectOutOfOrder());
  eq(afterOutOfOrder, false, 'After renumber, detectInvoiceOrderingMismatch() returns false');

  console.log('\n[9] Edit a payment date → verify auto-renumber');
  // Move Gavan's payment date to 13 May (latest of all) — expect it to become INV-8507
  // and DS Flooring to drop to INV-8506.
  await page.evaluate(async () => {
    await window.__reputifly._test_setPaymentDate('gavan', '2026-05-13');
  });
  const afterEdit = await page.evaluate(() => {
    const s = window.__reputifly.getState();
    return {
      gavan:   s.invoices.get('gavan'),
      dsfloor: s.invoices.get('dsfloor')
    };
  });
  eq(afterEdit.gavan.number, 8507, 'After moving Gavan to 13-May, it becomes INV-8507 (highest)');
  eq(afterEdit.dsfloor.number, 8506, 'DS Flooring (now next-latest) becomes INV-8506');

  console.log('\n[10] Verify counter is unchanged (still 8507 — forward-only)');
  const counterAfter = await page.evaluate(() => window.__reputifly.getState().counters.invoice.value);
  eq(counterAfter, 8507, 'Counter stays at 8507 — renumber permutes the existing pool, never grows it');

  console.log('\n[11] Drawer shows "Payment date" field for paid invoices');
  await page.evaluate(() => window.__reputifly.setRoute('invoices'));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__reputifly.openDrawer('invoice', 'eugene'));
  await page.waitForTimeout(150);
  const drawerHas = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('#drawer-body .section-title')).map(s => s.textContent);
    const hasInput = !!document.querySelector('#meta-payment-date');
    return { sections, hasInput };
  });
  console.log('  Drawer sections:', drawerHas.sections);
  eq(drawerHas.sections.includes('Payment date'), true, 'Drawer for paid invoice shows "Payment date" section');
  eq(drawerHas.hasInput, true, '#meta-payment-date input is rendered');

  // Close drawer for the next steps
  await page.evaluate(() => document.getElementById('drawer-close')?.click());
  await page.waitForTimeout(100);

  console.log('\n[12] Month summary panel renders + computes correct totals');
  // After step [9] above we left invoices at:
  //   gavan (13-May) → 8507,  dsfloor (12-May) → 8506,  ancient (12-May) → 8505,
  //   eugene (10-May) → 8504, newdays (10-May) → 8503, eben (09-May) → 8502,
  //   purposeful (08-May) → 8501, gentech (07-May) → 8500.
  // All payments are in 2026-05 so the May 2026 paid revenue = 8 × $100 = $800.
  await page.evaluate(() => { window.__reputifly.getState().monthFilter = '2026-05'; window.__reputifly.forceRender(); });
  await page.waitForTimeout(100);
  const ms = await page.evaluate(() => {
    const host = document.getElementById('month-summary-panel');
    const sel = host?.querySelector('select.ms-month');
    const paidVal = host?.querySelectorAll('.ms-stat')?.[0]?.querySelector('.ms-stat-value')?.textContent.trim();
    const paidCount = host?.querySelectorAll('.ms-stat')?.[0]?.querySelector('.ms-stat-meta')?.textContent.trim();
    const pendingVal = host?.querySelectorAll('.ms-stat')?.[1]?.querySelector('.ms-stat-value')?.textContent.trim();
    return { selected: sel?.value, paidVal, paidCount, pendingVal };
  });
  console.log('  Month summary state:', ms);
  eq(ms.selected, '2026-05', 'Month picker selects 2026-05');
  eq(ms.paidVal, 'S$800.00', 'Paid revenue for May 2026 = S$800.00 (8 × S$100)');
  eq(ms.paidCount, '8 invoices', 'Paid count = 8 invoices');

  // Switch to "all time" → totals should not exceed full data set (still S$800 paid here)
  await page.evaluate(() => { window.__reputifly.getState().monthFilter = 'all'; window.__reputifly.forceRender(); });
  await page.waitForTimeout(100);
  const msAll = await page.evaluate(() => {
    const host = document.getElementById('month-summary-panel');
    return host?.querySelectorAll('.ms-stat')?.[0]?.querySelector('.ms-stat-value')?.textContent.trim();
  });
  eq(msAll, 'S$800.00', 'All-time paid revenue = S$800.00');

  console.log('\n[13] 3-dot row menu includes "Edit payment date…" for paid invoices');
  // Trigger the row menu function directly so we don't have to position-click.
  const menuLabels = await page.evaluate(() => {
    const s = window.__reputifly.getState();
    const inv = s.invoices.get('eugene');
    // Call openRowMenu indirectly: it's not on the test API but we can
    // grab the items by mimicking what it does — call it via a dispatched click on the
    // 3-dot button.
    const rows = document.querySelectorAll('#invoices-list .list-row');
    let target;
    for (const r of rows) if (r.querySelector('.list-cell-num span')?.textContent.trim() === inv.displayNumber) { target = r; break; }
    if (!target) return ['<row not found>'];
    target.querySelector('.list-cell-actions button')?.click();
    // The popover is appended to document.body
    return Array.from(document.body.querySelectorAll('div[style*="position: fixed"] button')).map(b => b.textContent);
  });
  console.log('  Menu items:', menuLabels);
  eq(menuLabels.includes('Edit payment date…'), true, 'Row menu includes "Edit payment date…"');
  eq(menuLabels.includes('Void invoice…'), true, 'Row menu still includes "Void invoice…"');
  eq(menuLabels.includes('Open'), true, 'Row menu still includes "Open"');

  console.log('\n──── Summary ────');
  if (failed === 0) console.log('  ALL CHECKS PASSED ✓');
  else console.log(`  ${failed} CHECK(S) FAILED ✗`);

  await browser.close();
  server.close();
  process.exit(failed === 0 ? 0 : 1);
})();
