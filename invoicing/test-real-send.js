// One-shot real email send through the actual popup UI. Uses live
// Firestore + live Reputifly API. Recipient = first arg or default.

const { chromium } = require('playwright');

const VIEW_URL = 'http://127.0.0.1:8585/view.html?i=b1i2xia0op2mxi02';
const RECIPIENT = process.argv[2] || 'realjuliantung@gmail.com';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 1400 } });
  const page = await context.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[browser:error]', m.text()); });

  await page.goto(VIEW_URL);
  await page.waitForSelector('#invoice-host .page', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click('#download-pdf');
  await page.waitForFunction(() => !document.getElementById('es-sheet').hidden, { timeout: 5000 });
  await page.waitForTimeout(300);
  await page.fill('#es-email', RECIPIENT);

  const respPromise = page.waitForResponse(r =>
    r.url().includes('cloudfunctions.net/reputifly') && r.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.click('#es-send');
  const res = await respPromise;
  let body = null;
  try { body = await res.json(); } catch {}
  console.log('API response:', res.status(), JSON.stringify(body));

  if (res.status() === 200 && body && body.success) {
    console.log(`\n✓ Email sent to ${RECIPIENT}.\n`);
  } else {
    console.error('\n✗ Send failed.\n');
    process.exitCode = 1;
  }

  await browser.close();
})();
