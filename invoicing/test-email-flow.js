// Headless verification of the new "Send me via email" popup in
// view.html. Mocks fetch so no live email is sent. Drives the EXACT
// same DOM the real client click hits, then asserts the POST payload
// shape, accountant flow, dedupe, validation, voided-invoice gating,
// download fallback, and rate-limit error handling.
//
// Run while dev-server.js is up on http://127.0.0.1:8585:
//   node test-email-flow.js
//
// Exits non-zero on first failure with a clear message; everything
// passing prints `OK · all <N> assertions passed`.

const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:8585/view.html?i=x';

const SAMPLE = {
  displayNumber: 'QINV-T01',
  issueDate: '2026-05-01',
  company: {
    name: 'Reputifly Pte Ltd',
    uen: '202531855M',
    address: 'Woods Square, 12 Woodlands Square, #13-079, Singapore 737715',
    email: 'hello@reputifly.com',
  },
  client: { name: 'Test Client', email: 'client@example.com' },
  items: [{ description: 'Test item', subtitle: 'For QA', qty: 1, rate: 240, amount: 240 }],
  subtotal: 240,
  total: 240,
  status: 'sent',
};

let assertionCount = 0;
function assert(cond, msg) {
  assertionCount++;
  if (!cond) {
    console.error('  ✗ ' + msg);
    throw new Error('assertion failed: ' + msg);
  }
  console.log('  ✓ ' + msg);
}

async function setupPage(browser, { fetchStatus = 200, fetchBody = { success: true } } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1400 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('    [pageerror]', e.message));
  page.on('console', m => {
    if (m.type() === 'error') console.log('    [browser:error]', m.text());
  });

  // Inject fetch mock BEFORE any script runs. Captures every POST to
  // the cloudfunctions endpoint, lets every other request through.
  await page.addInitScript(({ status, body }) => {
    window.__capturedPayloads = [];
    window.__fetchStatusResponse = { status, body };
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (url, opts) {
      const u = String(url);
      if (u.includes('cloudfunctions.net/reputifly')) {
        let payload = null;
        try { payload = JSON.parse(opts && opts.body); } catch {}
        window.__capturedPayloads.push({ url: u, payload });
        const cfg = window.__fetchStatusResponse;
        return new Response(JSON.stringify(cfg.body), {
          status: cfg.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return origFetch(url, opts);
    };
    // Also stub html2pdf so the download path doesn't try to actually
    // serialise a PDF in the headless test (we only assert it was invoked).
    window.__h2pCalls = 0;
  }, { status: fetchStatus, body: fetchBody });

  await page.goto(BASE);
  await page.waitForFunction(() => typeof window.__test_renderShare === 'function', { timeout: 15000 });
  return { context, page };
}

async function renderInvoice(page, doc = SAMPLE) {
  await page.evaluate((d) => window.__test_renderShare(d), doc);
  await page.waitForSelector('#invoice-host .page', { timeout: 5000 });
  await page.waitForTimeout(300);
}

async function openSheet(page) {
  await page.click('#download-pdf');
  await page.waitForFunction(() => !document.getElementById('es-sheet').hidden, { timeout: 2000 });
  // Wait for animation + focus.
  await page.waitForTimeout(300);
}

async function clearCaptured(page) {
  await page.evaluate(() => { window.__capturedPayloads = []; });
}

async function test1_singleRecipient(browser) {
  console.log('\n[1] Single-recipient send + payload shape');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page);
  await openSheet(page);

  // Recipient should be pre-filled from d.client.email.
  const prefilled = await page.inputValue('#es-email');
  assert(prefilled === 'client@example.com', `recipient pre-filled (got "${prefilled}")`);

  // Subtitle should show invoice number + amount.
  const sub = (await page.textContent('#es-sub')).trim();
  assert(/QINV-T01/.test(sub) && /S\$240\.00/.test(sub), `subtitle has number + amount (got "${sub}")`);

  // Replace recipient and send.
  await page.fill('#es-email', 'runikojane@gmail.com');
  await clearCaptured(page);
  await page.click('#es-send');

  await page.waitForFunction(() => window.__capturedPayloads && window.__capturedPayloads.length === 1, { timeout: 10000 });
  const captured = await page.evaluate(() => window.__capturedPayloads);
  assert(captured.length === 1, '1 POST captured');

  const p = captured[0].payload;
  assert(p._to === 'runikojane@gmail.com', '_to is runikojane@gmail.com (active billing account)');
  assert(p._send_to === 'runikojane@gmail.com', '_send_to is the recipient');
  assert(/^Invoice .+ from .+ — S\$/.test(p._subject), `_subject matches expected format (got "${p._subject}")`);
  assert(p._sender_name === 'Reputifly Pte Ltd', `_sender_name is the company name (got "${p._sender_name}")`);
  assert(p._brand_color === '#0B0A14', '_brand_color present');
  assert(typeof p._brand_logo === 'string' && p._brand_logo.length > 0, '_brand_logo present');
  assert(typeof p._auto_reply_content === 'string' && p._auto_reply_content.length > 100, '_auto_reply_content is non-trivial HTML');

  const html = p._auto_reply_content;
  assert(html.includes('reputifly.org/invoicing/assets/paynow-qr.jpeg'), 'email HTML uses public QR URL (not data:)');
  assert(!/src="data:image\//.test(html), 'email HTML does NOT use data: image (Gmail strips those)');
  assert(html.includes('S$240.00'), 'email HTML contains amount');
  assert(html.includes('QINV-T01'), 'email HTML contains invoice number');
  assert(html.includes('Reputifly Pte Ltd'), 'email HTML contains company name');
  assert(html.includes('202531855M'), 'email HTML contains UEN');
  assert(html.includes('view.html?i=x'), 'email HTML contains share URL link');
  assert(html.includes('Download Invoice PDF'), 'email HTML primary CTA labelled "Download Invoice PDF"');
  assert(html.includes('download-icon.png'), 'email HTML primary CTA uses hosted PNG download icon');
  assert(html.includes('Contact Reputifly'), 'email HTML has "Contact Reputifly" secondary link');
  assert(html.includes('wa.me/6580111965'), 'email HTML secondary link points to WhatsApp');
  assert(/dl=1/.test(html), 'email HTML primary CTA has ?dl=1 for auto-download');

  // Toast should appear, sheet should close.
  await page.waitForFunction(() => document.querySelectorAll('.es-toast').length > 0, { timeout: 2000 });
  const toastTxt = await page.textContent('.es-toast');
  assert(/runikojane@gmail\.com/.test(toastTxt), `toast names the recipient (got "${toastTxt}")`);
  await page.waitForFunction(() => document.getElementById('es-sheet').hidden, { timeout: 1000 });

  await context.close();
}

async function test2_accountantFlow(browser) {
  console.log('\n[2] Accountant flow → 2 POSTs');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page);
  await openSheet(page);

  await page.fill('#es-email', 'me@example.com');
  await page.click('#es-acc-toggle');
  await page.waitForSelector('#es-acc-wrap:not([hidden])');
  await page.fill('#es-acc-email', 'accountant@firm.com');
  await clearCaptured(page);
  await page.click('#es-send');

  await page.waitForFunction(() => window.__capturedPayloads && window.__capturedPayloads.length === 2, { timeout: 10000 });
  const captured = await page.evaluate(() => window.__capturedPayloads);
  assert(captured.length === 2, '2 POSTs captured');
  const tos = captured.map(c => c.payload._send_to).sort();
  assert(tos[0] === 'accountant@firm.com' && tos[1] === 'me@example.com', `both addresses sent (got ${JSON.stringify(tos)})`);

  // Toast should mention "you and your accountant".
  await page.waitForFunction(() => document.querySelectorAll('.es-toast').length > 0, { timeout: 2000 });
  const toastTxt = await page.textContent('.es-toast');
  assert(/accountant/i.test(toastTxt), `toast mentions accountant (got "${toastTxt}")`);

  await context.close();
}

async function test3_dedupe(browser) {
  console.log('\n[3] Same recipient + accountant → dedupe to 1 POST');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page);
  await openSheet(page);

  await page.fill('#es-email', 'same@example.com');
  await page.click('#es-acc-toggle');
  await page.fill('#es-acc-email', 'SAME@example.com'); // case-insensitive check
  await clearCaptured(page);
  await page.click('#es-send');

  await page.waitForFunction(() => window.__capturedPayloads && window.__capturedPayloads.length >= 1, { timeout: 10000 });
  await page.waitForTimeout(300);
  const captured = await page.evaluate(() => window.__capturedPayloads);
  assert(captured.length === 1, `dedupe: exactly 1 POST (got ${captured.length})`);

  await context.close();
}

async function test4_validation(browser) {
  console.log('\n[4] Invalid email → no POST + inline error');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page);
  await openSheet(page);

  await page.fill('#es-email', 'not-an-email');
  await clearCaptured(page);
  await page.click('#es-send');
  await page.waitForTimeout(300);

  const captured = await page.evaluate(() => window.__capturedPayloads);
  assert(captured.length === 0, 'no POST fired');

  const hasErrorClass = await page.evaluate(() => document.getElementById('es-email').classList.contains('es-input--error'));
  assert(hasErrorClass, 'recipient input has error class');
  const errVisible = await page.evaluate(() => !document.getElementById('es-email-err').hidden);
  assert(errVisible, 'inline error message is visible');

  await context.close();
}

async function test5_voidedInvoice(browser) {
  console.log('\n[5] Voided invoice → button has aria-disabled, banner shows');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page, { ...SAMPLE, status: 'void' });

  const ariaDisabled = await page.getAttribute('#download-pdf', 'aria-disabled');
  assert(ariaDisabled === 'true', `at-rest button aria-disabled (got "${ariaDisabled}")`);

  // Force-open the sheet and verify the banner appears.
  await page.evaluate((d) => window.__test_openEmailSheet(d, document.querySelector('#invoice-host > div')), { ...SAMPLE, status: 'void' });
  await page.waitForFunction(() => !document.getElementById('es-sheet').hidden, { timeout: 2000 });
  await page.waitForTimeout(200);

  const bannerVisible = await page.evaluate(() => !document.getElementById('es-banner').hidden);
  assert(bannerVisible, 'voided banner visible inside sheet');
  const formHidden = await page.evaluate(() => document.getElementById('es-form').style.display === 'none');
  assert(formHidden, 'form is hidden for voided invoice');

  await context.close();
}

async function test6_rateLimit(browser) {
  console.log('\n[6] 429 rate limit → inline error message');
  const { context, page } = await setupPage(browser, { fetchStatus: 429, fetchBody: { error: 'Rate limited' } });
  await renderInvoice(page);
  await openSheet(page);

  await page.fill('#es-email', 'me@example.com');
  await page.click('#es-send');

  await page.waitForFunction(() => !document.getElementById('es-form-err').hidden, { timeout: 5000 });
  const errTxt = await page.textContent('#es-form-err');
  assert(/wait a minute/i.test(errTxt) || /too many/i.test(errTxt), `429 message shown (got "${errTxt}")`);

  await context.close();
}

async function test7_403Forbidden(browser) {
  console.log('\n[7] 403 forbidden → "service disabled" message');
  const { context, page } = await setupPage(browser, { fetchStatus: 403, fetchBody: { error: 'Direct Email feature not enabled.' } });
  await renderInvoice(page);
  await openSheet(page);

  await page.fill('#es-email', 'me@example.com');
  await page.click('#es-send');

  await page.waitForFunction(() => !document.getElementById('es-form-err').hidden, { timeout: 5000 });
  const errTxt = await page.textContent('#es-form-err');
  assert(/disabled/i.test(errTxt) || /try downloading/i.test(errTxt), `403 message shown (got "${errTxt}")`);

  await context.close();
}

async function test8_noClientEmail(browser) {
  console.log('\n[8] Missing d.client.email → recipient empty, placeholder shown');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page, { ...SAMPLE, client: { name: 'Walk-in' } });
  await openSheet(page);

  const val = await page.inputValue('#es-email');
  assert(val === '', `recipient input empty (got "${val}")`);
  const placeholder = await page.getAttribute('#es-email', 'placeholder');
  assert(/example\.com/.test(placeholder), `placeholder helpful (got "${placeholder}")`);

  await context.close();
}

async function test10_autoDownload(browser) {
  console.log('\n[10] ?dl=1 → auto-download overlay appears, fires download');
  const { context, page } = await setupPage(browser);
  // Stub html2pdf so the test doesn't actually serialise a real PDF.
  // We only need to assert the flow reached the download stage.
  await page.addInitScript(() => {
    window.__h2pCalled = false;
    Object.defineProperty(window, 'html2pdf', {
      configurable: true,
      get() {
        return function () {
          window.__h2pCalled = true;
          // Return a chainable stub that resolves like html2pdf would.
          const stub = {
            set() { return stub; },
            from() { return stub; },
            toPdf: async () => stub,
            get: async () => ({
              deletePage() {}, addPage() {}, addImage() {}, save() { window.__pdfSaved = true; },
            }),
          };
          return stub;
        };
      },
    });
  });
  // Navigate WITH dl=1 so the boot trigger fires after render.
  await page.goto(BASE.replace('?i=x', '?i=x&dl=1'));
  await page.waitForFunction(() => typeof window.__test_renderShare === 'function');
  await renderInvoice(page);

  // Overlay should appear within ~1s.
  await page.waitForSelector('.dl-overlay.is-open', { timeout: 3000 });
  assert(true, 'auto-download overlay opened');

  // Wait for the download to "complete" (stub resolves quickly).
  await page.waitForFunction(() => window.__pdfSaved === true, { timeout: 15000 });
  assert(true, 'html2pdf save was invoked');

  // Success state should swap in (icon + "View invoice" / "Download again" buttons).
  await page.waitForSelector('.dl-overlay__card button[data-act="view"]', { timeout: 5000 });
  assert(true, 'success state with "View invoice" button rendered');

  // URL should have ?dl stripped so refresh doesn't re-trigger.
  const urlAfter = await page.url();
  assert(!/[?&]dl=1/.test(urlAfter), `dl=1 stripped from URL after auto-download (got "${urlAfter}")`);

  // Click "View invoice" → overlay dismisses.
  await page.click('.dl-overlay__card button[data-act="view"]');
  await page.waitForFunction(() => !document.querySelector('.dl-overlay'), { timeout: 2000 });
  assert(true, '"View invoice" dismisses overlay');

  await context.close();
}

async function test9_closeBehaviours(browser) {
  console.log('\n[9] Close via × / scrim / Escape');
  const { context, page } = await setupPage(browser);
  await renderInvoice(page);

  // Close via × button
  await openSheet(page);
  await page.click('#es-close');
  await page.waitForFunction(() => document.getElementById('es-sheet').hidden, { timeout: 1500 });
  assert(true, 'close × works');

  // Close via Escape key
  await openSheet(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('es-sheet').hidden, { timeout: 1500 });
  assert(true, 'Escape closes sheet');

  // Close via scrim click — synthesise a click on the scrim element
  // directly, since the centred sheet covers most of the viewport in
  // headless and would otherwise intercept the pointer event.
  await openSheet(page);
  await page.evaluate(() => document.getElementById('es-scrim').click());
  await page.waitForFunction(() => document.getElementById('es-sheet').hidden, { timeout: 1500 });
  assert(true, 'scrim click closes sheet');

  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await test1_singleRecipient(browser);
    await test2_accountantFlow(browser);
    await test3_dedupe(browser);
    await test4_validation(browser);
    await test5_voidedInvoice(browser);
    await test6_rateLimit(browser);
    await test7_403Forbidden(browser);
    await test8_noClientEmail(browser);
    await test9_closeBehaviours(browser);
    await test10_autoDownload(browser);
    console.log(`\nOK · all ${assertionCount} assertions passed`);
  } catch (e) {
    console.error('\nFAILED:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
