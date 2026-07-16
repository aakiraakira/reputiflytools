// Proves that a [label](url) typed into a line item becomes a REAL, clickable
// link annotation in the generated PDF — not just blue pixels.
//
// The PDF is a flat raster (html2canvas -> PNG -> jsPDF.addImage), so a URL
// drawn into it is unclickable by definition. The only thing that makes it
// clickable is a /Annots -> /Subtype /Link -> /URI entry in the PDF objects.
// This asserts on the actual bytes rather than trusting a viewer.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8687;
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
const check = (cond, m) => cond ? ok(m) : bad(m);

const TARGET = 'https://reputifly.com/proposal/l1abc';

(async () => {
  const server = await serve();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => bad('pageerror: ' + e.message));

  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(400);

  // ---- 1. parser: label shown, url hidden, hostile schemes refused ----
  const parsed = await page.evaluate((target) => {
    const f = window.__reputifly._test_renderInlineLinks;
    const P = h => { const d = document.createElement('div'); d.innerHTML = h; return d; };
    const happy = P(f(`Website Design (70% Deposit) [View Proposal](${target}) enclosed`));
    const js = P(f('[Click](' + 'javascript' + ':alert(1))'));
    const inj = P(f('[<img src=x onerror=boom>](https://ok.com/a)'));
    return {
      anchors: happy.querySelectorAll('a').length,
      label: happy.querySelector('a') && happy.querySelector('a').textContent,
      urlHidden: happy.textContent.indexOf('reputifly.com') === -1,
      rawSyntaxGone: happy.textContent.indexOf('](') === -1,
      jsAnchors: js.querySelectorAll('a').length,
      injImgs: inj.querySelectorAll('img').length
    };
  }, TARGET);
  check(parsed.anchors === 1, 'one anchor produced');
  check(parsed.label === 'View Proposal', `label reads "View Proposal" (got "${parsed.label}")`);
  check(parsed.urlHidden, 'URL hidden from visible text');
  check(parsed.rawSyntaxGone, 'raw [](…) syntax not shown to client');
  check(parsed.jsAnchors === 0, 'javascript: scheme refused');
  check(parsed.injImgs === 0, 'markup in label escaped');

  // ---- 2. the real thing: generate a PDF and read its bytes ----
  const pdf = await page.evaluate(async (target) => {
    const d = {
      status: 'draft', displayNumber: 'QINV-999', issueDate: '2026-07-16',
      client: { name: 'L1 Motorsports Pte Ltd' },
      items: [{ description: `Website Design (70% Deposit) [View Proposal](${target}) enclosed`, subtitle: '', qty: 1, rate: 413, amount: 413 }],
      subtotal: 413, total: 413, notes: '', optional: {}
    };
    const uri = await window.__reputifly._test_pdfDataUri(d, 'invoice');
    const bin = atob(uri.split(',')[1]);
    return {
      bytes: bin.length,
      hasAnnots: bin.includes('/Annots'),
      linkSubtypes: (bin.match(/\/Subtype\s*\/Link/g) || []).length,
      hasURI: bin.includes('/URI'),
      hasTargetUrl: bin.includes(target)
    };
  }, TARGET);

  console.log('  pdf bytes:', pdf.bytes);
  check(pdf.bytes > 10000, 'PDF actually generated');
  check(pdf.hasAnnots, 'PDF contains /Annots (annotation array)');
  check(pdf.linkSubtypes >= 1, `PDF contains a /Subtype /Link annotation (found ${pdf.linkSubtypes})`);
  check(pdf.hasURI, 'PDF contains a /URI action');
  check(pdf.hasTargetUrl, 'PDF embeds the real target URL');

  // ---- 3. an invoice with NO link must gain no annotations (no regression) ----
  const plain = await page.evaluate(async () => {
    const d = {
      status: 'draft', displayNumber: 'QINV-998', issueDate: '2026-07-16',
      client: { name: 'Plain Co' },
      items: [{ description: 'Website Design (70% Deposit)', subtitle: '', qty: 1, rate: 413, amount: 413 }],
      subtotal: 413, total: 413, notes: '', optional: {}
    };
    const uri = await window.__reputifly._test_pdfDataUri(d, 'invoice');
    const bin = atob(uri.split(',')[1]);
    return { linkSubtypes: (bin.match(/\/Subtype\s*\/Link/g) || []).length, bytes: bin.length };
  });
  check(plain.linkSubtypes === 0, `link-free invoice gets zero link annotations (found ${plain.linkSubtypes})`);
  check(plain.bytes > 10000, 'link-free invoice still generates normally');

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK all inline-link checks passed');
  process.exit(failed ? 1 : 0);
})();
