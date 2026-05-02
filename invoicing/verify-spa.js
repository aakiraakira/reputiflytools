/**
 * verify-spa.js
 *
 * 1. Starts a static HTTP server in the project folder (Firebase Auth needs HTTP).
 * 2. Opens the SPA via Playwright in dev mode (?dev=1) which seeds in-memory data.
 * 3. Captures screenshots of every tab on desktop + mobile.
 * 4. Triggers PDF generation and compares against the standalone templates.
 * 5. Saves all artefacts with prefix `spa-verify-` in the project folder AND in
 *    %USERPROFILE%/Downloads.
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_DIR = __dirname;
const PORT = 8181;
const DOWNLOADS_DIR = path.join(os.homedir(), 'Downloads');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
        const filePath = path.join(PROJECT_DIR, urlPath);
        if (!filePath.startsWith(PROJECT_DIR)) { res.writeHead(403); res.end('forbidden'); return; }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.writeHead(404); res.end('not found'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        fs.createReadStream(filePath).pipe(res);
      } catch (e) {
        res.writeHead(500); res.end(String(e));
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function outPath(name) { return path.join(PROJECT_DIR, `spa-verify-${name}`); }

function copyToDownloads(name) {
  try {
    fs.copyFileSync(outPath(name), path.join(DOWNLOADS_DIR, `spa-verify-${name}`));
  } catch (e) {
    console.warn(`[copy] ${name} → Downloads failed: ${e.message}`);
  }
}

async function captureView(page, route, name) {
  await page.evaluate((r) => window.__reputifly.setRoute(r), route);
  await page.waitForTimeout(300);
  const file = `${name}.png`;
  await page.screenshot({ path: outPath(file), fullPage: true });
  copyToDownloads(file);
  console.log(`  saved ${file}`);
}

(async () => {
  console.log('[1/6] Starting local HTTP server on port', PORT);
  const server = await startServer();
  const browser = await chromium.launch();

  try {
    // ── Desktop ─────────────────────────────────────────────
    console.log('[2/6] Capturing desktop screenshots');
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });

    // Login screen — without ?dev=1
    {
      const page = await desktop.newPage();
      // strip Firebase init by stubbing — we just want the auth screen as-is.
      // Block firebase scripts so app stays on login screen
      await page.route('**/firebase*.js', route => route.abort());
      await page.route('**/firebasejs/**/*', route => route.abort());
      await page.goto(`http://127.0.0.1:${PORT}/index.html`);
      await page.waitForTimeout(800);
      await page.screenshot({ path: outPath('desktop-login.png'), fullPage: true });
      copyToDownloads('desktop-login.png');
      console.log('  saved desktop-login.png');
      await page.close();
    }

    // Dev mode for the rest
    const dpage = await desktop.newPage();
    dpage.on('pageerror', e => console.error('  [pageerror]', e.message));
    await dpage.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
    await dpage.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await dpage.waitForTimeout(800);

    await captureView(dpage, 'creation', 'desktop-creation');
    await captureView(dpage, 'quotations', 'desktop-quotations');
    await captureView(dpage, 'invoices', 'desktop-invoices');
    await captureView(dpage, 'advanced', 'desktop-advanced');

    // Open drawer on a quotation
    await dpage.evaluate(() => {
      const id = Array.from(window.__reputifly.getState().quotations.keys())[0];
      window.__reputifly.openDrawer('quotation', id);
    });
    await dpage.waitForTimeout(450);
    await dpage.screenshot({ path: outPath('desktop-drawer-quotation.png'), fullPage: true });
    copyToDownloads('desktop-drawer-quotation.png');
    console.log('  saved desktop-drawer-quotation.png');

    // ── Mobile ──────────────────────────────────────────────
    console.log('[3/6] Capturing mobile screenshots');
    const mobile = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2
    });
    const mpage = await mobile.newPage();
    mpage.on('pageerror', e => console.error('  [pageerror]', e.message));
    await mpage.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
    await mpage.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await mpage.waitForTimeout(800);

    await captureView(mpage, 'creation', 'mobile-creation');
    await captureView(mpage, 'quotations', 'mobile-quotations');
    await captureView(mpage, 'invoices', 'mobile-invoices');
    await captureView(mpage, 'advanced', 'mobile-advanced');

    await mpage.evaluate(() => {
      const id = Array.from(window.__reputifly.getState().quotations.keys())[0];
      window.__reputifly.openDrawer('quotation', id);
    });
    await mpage.waitForTimeout(450);
    await mpage.screenshot({ path: outPath('mobile-drawer-quotation.png'), fullPage: true });
    copyToDownloads('mobile-drawer-quotation.png');
    console.log('  saved mobile-drawer-quotation.png');

    // ── PDFs ────────────────────────────────────────────────
    // Use Playwright's page.pdf() against the iframe's HTML. Easier: render
    // the doc directly in the page DOM using the data and call page.pdf().
    console.log('[4/6] Generating SPA-rendered PDFs');
    const pdfCtx = await browser.newContext({ viewport: { width: 794, height: 1123 } });
    const ppage = await pdfCtx.newPage();
    await ppage.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
    await ppage.waitForFunction(() => window.__reputifly && window.__reputifly.isDev, null, { timeout: 10000 });
    await ppage.waitForTimeout(800);

    // Build print HTML inside the page using the SPA's bind logic, then write it
    // to the test page and snapshot it as a PDF.
    async function renderSpaPdf(variant, slug) {
      const html = await ppage.evaluate((variant) => {
        const state = window.__reputifly.getState();
        // Pick the first invoice as the data source
        const d = Array.from(state.invoices.values())[0];
        if (!d) return null;

        // Replicate the bind logic
        const tpl = document.querySelector(`#tpl-${variant}`);
        const clone = tpl.content.cloneNode(true);
        const root = document.createElement('div');
        root.appendChild(clone);

        // We can't directly call private bindPdfData from outside, but we can
        // call downloadPdf and then capture iframe content. Instead, call the
        // bind via a probe: open & close the iframe path.
        // Simpler: trigger downloadPdf which writes to iframe, then read iframe
        // contents back.
        return null;
      }, variant);

      // Trigger the SPA's actual downloadPdf and read the iframe's HTML
      await ppage.evaluate(async (variant) => {
        const state = window.__reputifly.getState();
        const d = Array.from(state.invoices.values())[0];
        // Mark with terms for the with-terms variant
        const data = { ...d };
        if (variant === 'invoice-with-terms') {
          data.terms = state.settings.defaultTerms;
        }
        // Call the SPA's downloadPdf (which writes to the hidden iframe and prints)
        // But print would open a dialog in headed; in headless it's a no-op,
        // so we just need the iframe DOM.
        await window.__reputifly.downloadPdf(data, variant);
      }, variant);
      await ppage.waitForTimeout(800);

      // Extract the iframe HTML and load it into a fresh page so we can call page.pdf()
      const iframeHtml = await ppage.evaluate(() => {
        const f = document.getElementById('print-iframe');
        return f.contentDocument ? f.contentDocument.documentElement.outerHTML : null;
      });
      if (!iframeHtml) {
        console.warn(`  [warn] iframe HTML for ${variant} was empty`);
        return;
      }

      const tmp = await pdfCtx.newPage();
      await tmp.setContent(iframeHtml, { waitUntil: 'networkidle' });
      await tmp.evaluate(() => document.fonts && document.fonts.ready);
      await tmp.waitForTimeout(800);

      const pngPath = outPath(`pdf-${slug}.png`);
      await tmp.locator('.page').first().screenshot({ path: pngPath });
      copyToDownloads(`pdf-${slug}.png`);

      const pdfPath = outPath(`pdf-${slug}.pdf`);
      await tmp.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      copyToDownloads(`pdf-${slug}.pdf`);
      console.log(`  saved pdf-${slug}.pdf and pdf-${slug}.png`);
      await tmp.close();
    }

    await renderSpaPdf('invoice', 'spa-invoice');
    await renderSpaPdf('invoice-with-terms', 'spa-invoice-with-terms');

    // ── Standalone template parity ──────────────────────────
    console.log('[5/6] Rendering standalone templates for parity comparison');
    const tCtx = await browser.newContext({
      viewport: { width: 794, height: 1123 },
      deviceScaleFactor: 2
    });
    const tplTargets = [
      { html: 'invoice-template.html',            slug: 'standalone-invoice' },
      { html: 'invoice-template-with-terms.html', slug: 'standalone-invoice-with-terms' }
    ];
    for (const tgt of tplTargets) {
      const tp = await tCtx.newPage();
      await tp.goto(`http://127.0.0.1:${PORT}/${tgt.html}`);
      await tp.waitForLoadState('networkidle');
      await tp.waitForTimeout(800);

      const pngPath = outPath(`pdf-${tgt.slug}.png`);
      await tp.locator('.page').first().screenshot({ path: pngPath });
      copyToDownloads(`pdf-${tgt.slug}.png`);

      const pdfPath = outPath(`pdf-${tgt.slug}.pdf`);
      await tp.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      copyToDownloads(`pdf-${tgt.slug}.pdf`);
      console.log(`  saved pdf-${tgt.slug}.pdf and pdf-${tgt.slug}.png`);
      await tp.close();
    }

    console.log('[6/6] Done');
  } catch (e) {
    console.error('VERIFY FAILED:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
