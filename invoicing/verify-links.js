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

  // ---- 4. an unfilled placeholder must NEVER become a link ----
  const placeholder = await page.evaluate(() => {
    const f = window.__reputifly._test_renderInlineLinks;
    const P = h => { const d = document.createElement('div'); d.innerHTML = h; return d; };
    return {
      empty: P(f('[Proposal]()')).querySelectorAll('a').length,
      spaces: P(f('[Proposal](   )')).querySelectorAll('a').length,
      notUrl: P(f('[Proposal](tbc)')).querySelectorAll('a').length,
      halfTyped: P(f('[Proposal](https://')).querySelectorAll('a').length
    };
  });
  check(placeholder.empty === 0, 'unfilled [Proposal]() is not a link');
  check(placeholder.spaces === 0, '[Proposal](   ) is not a link');
  check(placeholder.notUrl === 0, '[Proposal](tbc) is not a link');
  check(placeholder.halfTyped === 0, 'half-typed [Proposal](https:// is not a link');

  // ---- 5. links inside TERMS sections (page 2) are clickable too ----
  // These bodies reference the Service Terms / Meta Ads ToS, which used to be
  // dead text baked into the page-2 image.
  const TOS = 'https://reputifly.com/terms';
  const terms = await page.evaluate(async ({ tos, prop }) => {
    const R = window.__reputifly, st = R.getState();
    st.settings.defaultTerms = { title: 'Additional Information', subtitle: 'Terms', sections: [
      { id: 'sec-accept', heading: 'Acceptance of Terms and Proposal',
        body: `This Proposal sets out the scope. See [Reputifly's Service Terms](${tos}) and the [Proposal](${prop}).` },
      { id: 'sec-ph', heading: 'Placeholder', body: 'Unfilled [Proposal]() stays literal.' }
    ]};
    const d = {
      status: 'draft', displayNumber: 'QINV-777', issueDate: '2026-07-16',
      client: { name: 'L1 Motorsports' },
      items: [{ description: 'Website Design', subtitle: '', qty: 1, rate: 413, amount: 413 }],
      subtotal: 413, total: 413, notes: '', optional: {},
      termsSections: ['sec-accept', 'sec-ph'],
      terms: { title: 'Additional Information', subtitle: 'Terms', sections: [{ id: 'sec-accept' }, { id: 'sec-ph' }] }
    };
    const uri = await R._test_pdfDataUri(d, 'invoice-with-terms');
    const bin = atob(uri.split(',')[1]);
    return {
      variant: R._test_variantFor(d),
      linkAnnots: (bin.match(/\/Subtype\s*\/Link/g) || []).length,
      hasTos: bin.includes(tos),
      hasProp: bin.includes(prop)
    };
  }, { tos: TOS, prop: TARGET });
  check(terms.variant === 'invoice-with-terms', 'terms invoice is 2-page');
  check(terms.linkAnnots === 2, `page-2 terms links get clickable annotations (found ${terms.linkAnnots}, expected 2 — the unfilled one must not count)`);
  check(terms.hasTos, 'ToS URL embedded from a terms body');
  check(terms.hasProp, 'Proposal URL embedded from a terms body');

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK all inline-link checks passed');
  process.exit(failed ? 1 : 0);
})();
