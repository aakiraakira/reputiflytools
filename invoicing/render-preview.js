const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TARGETS = [
  { html: 'invoice-template.html',            slug: 'invoice' },
  { html: 'invoice-template-with-terms.html', slug: 'invoice-with-terms' },
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1100, height: 1400 },
    deviceScaleFactor: 2,
  });
  const downloadsDir = path.join(os.homedir(), 'Downloads');

  for (const target of TARGETS) {
    const page = await context.newPage();
    const htmlPath = path.resolve(__dirname, target.html);
    await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const logoOk = await page.evaluate(() => {
      const img = document.querySelector('.brand-logo');
      return img && img.complete && img.naturalWidth > 0;
    });
    const qrOk = await page.evaluate(() => {
      const img = document.querySelector('.qr-wrap img');
      return img && img.complete && img.naturalWidth > 0;
    });
    console.log(`[${target.slug}] logo:${logoOk}  qr:${qrOk}`);

    // Screenshot each .page individually so we get a sharp PNG per page
    const pageCount = await page.locator('.page').count();
    for (let i = 0; i < pageCount; i++) {
      const suffix = pageCount > 1 ? `-page${i + 1}` : '';
      const pngPath = path.join(__dirname, `${target.slug}${suffix}.png`);
      await page.locator('.page').nth(i).screenshot({ path: pngPath });
      fs.copyFileSync(pngPath, path.join(downloadsDir, `reputifly-${target.slug}${suffix}.png`));
    }

    // Single multi-page PDF
    const pdfPath = path.join(__dirname, `${target.slug}.pdf`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    fs.copyFileSync(pdfPath, path.join(downloadsDir, `reputifly-${target.slug}.pdf`));

    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
