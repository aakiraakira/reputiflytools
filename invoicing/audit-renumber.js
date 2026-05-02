// Verifies the QINV- counter decrements when the most-recent draft is deleted,
// but holds the gap for older drafts.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8484;
const PROJECT_DIR = __dirname;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
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
const fail = m => { failed++; console.error('FAIL:', m); };
const pass = m => console.log('PASS:', m);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => { failed++; console.error('pageerror:', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(500);

  const counterAt = () => page.evaluate(() => window.__reputifly.getState().counters.quotation.value);
  const drafts   = () => page.evaluate(() => Array.from(window.__reputifly.getState().quotations.values()).map(q => q.number));

  console.log('Initial counter:', await counterAt(), 'numbers:', await drafts());

  // Save 2 new drafts so we have a known sequence
  await page.evaluate(() => window.__reputifly.setRoute('creation'));
  await page.waitForTimeout(200);
  for (let i = 0; i < 2; i++) {
    await page.locator('.editor-page .party-name.ce').click();
    await page.keyboard.type('Test ' + (i + 1));
    await page.locator('.editor-page').click({ position: { x: 10, y: 10 } });
    await page.locator('#save-draft').click();
    await page.waitForTimeout(300);
  }

  const beforeDel = await counterAt();
  const dArr = await drafts();
  console.log('After 2 saves — counter:', beforeDel, 'numbers:', dArr);
  if (Math.max(...dArr) === beforeDel) pass('counter matches highest draft');
  else fail(`counter ${beforeDel} != highest ${Math.max(...dArr)}`);

  // Find the highest-number draft and delete it via the exposed action
  const targetId = await page.evaluate((maxN) => {
    const arr = Array.from(window.__reputifly.getState().quotations.values());
    return arr.find(q => q.number === maxN).id;
  }, beforeDel);
  // Stub re-auth + confirm to bypass the modal in headless mode
  await page.evaluate(async (id) => {
    const arr = Array.from(window.__reputifly.getState().quotations.values());
    const target = arr.find(q => q.id === id);
    // Directly invoke the same path as the kebab-Delete action
    await window.__reputifly._test_delete(id);
  }, targetId);
  await page.waitForTimeout(300);

  const afterDel = await counterAt();
  console.log('After deleting latest — counter:', afterDel);
  if (afterDel === beforeDel - 1) pass('counter decremented after deleting latest');
  else fail(`counter ${beforeDel} -> ${afterDel}, expected -1`);

  // Now delete an OLDER draft (number 1) — counter should NOT change
  const olderId = await page.evaluate(() => {
    const arr = Array.from(window.__reputifly.getState().quotations.values());
    return arr.find(q => q.number === 1)?.id || null;
  });
  if (olderId) {
    const counterBefore = await counterAt();
    await page.evaluate(async (id) => { await window.__reputifly._test_delete(id); }, olderId);
    await page.waitForTimeout(200);
    const counterAfter = await counterAt();
    if (counterAfter === counterBefore) pass('counter unchanged when deleting older draft');
    else fail(`counter ${counterBefore} -> ${counterAfter} (expected unchanged for older)`);
  }

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK All renumber checks passed');
  process.exit(failed ? 1 : 0);
})();
