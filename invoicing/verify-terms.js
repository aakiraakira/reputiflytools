// verify-terms.js
// Default-Terms freshness behaviour:
//   • Drafts always pull defaultTerms LIVE from settings — when the
//     user edits Advanced → Default Terms, the next draft PDF /
//     share doc reflects those edits without re-saving.
//   • Paid invoices keep the snapshot they were locked with at
//     conversion time (so the client's copy never silently changes).

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8494;
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
const fail = (m) => { failed++; console.error('  FAIL:', m); };
const pass = (m) => console.log('  PASS:', m);
const eq = (a, b, m) => (a === b ? pass(m) : fail(`${m}  got=${JSON.stringify(a)}  want=${JSON.stringify(b)}`));

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => { failed++; console.error('  pageerror:', e.message); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(300);

  console.log('\n[1] settings.defaultTerms can be mutated live');
  const live = await page.evaluate(() => {
    const s = window.__reputifly.getState();
    s.settings.defaultTerms = {
      title: 'LIVE-TITLE',
      subtitle: 'LIVE-SUBTITLE',
      sections: [{ heading: 'Live section', body: 'Live body content.' }]
    };
    return JSON.stringify({ title: s.settings.defaultTerms.title });
  });
  eq(JSON.parse(live).title, 'LIVE-TITLE', 'settings.defaultTerms updated in state');

  console.log('\n[2] initDraft() does NOT snapshot terms');
  // Call internal-only initDraft via setRoute('creation') which triggers it
  const draftTerms = await page.evaluate(() => {
    window.__reputifly.setRoute('creation');
    const s = window.__reputifly.getState();
    // Force re-init of draft to pick up our settings mutation
    s.draft = null;
    window.__reputifly.forceRender();
    return s.draft?.terms;
  });
  eq(draftTerms, null, 'state.draft.terms is null after initDraft (no snapshot)');

  console.log('\n──── Summary ────');
  if (failed === 0) console.log('  ALL CHECKS PASSED ✓');
  else console.log(`  ${failed} CHECK(S) FAILED ✗`);

  await browser.close();
  server.close();
  process.exit(failed === 0 ? 0 : 1);
})();
