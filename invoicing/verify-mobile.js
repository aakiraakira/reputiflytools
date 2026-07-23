// Mobile regression guard.
//
// The Library list used to set grid-template-columns as an INLINE style, which
// beats the mobile media query — 360px of fixed columns on a 390px screen, so
// the description's 1fr collapsed to zero (every row showed a blank name) and
// the actions column ran off the right edge. Also asserts tap targets big
// enough to hit one-handed, and that no page scrolls sideways.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8691;
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
const check = (c, m) => c ? ok(m) : bad(m);

const ROUTES = ['creation', 'quotations', 'invoices', 'library', 'advanced'];

(async () => {
  const server = await serve();
  const browser = await chromium.launch();

  // ---------------- MOBILE ----------------
  const mob = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await mob.newPage();
  page.on('pageerror', e => bad('pageerror: ' + e.message));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await page.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await page.waitForTimeout(400);

  // no route may scroll sideways, and nothing visible may hang off the right
  // edge (the closed drawer legitimately sits off-canvas, so it's excluded)
  for (const route of ROUTES) {
    const r = await page.evaluate(rt => {
      window.__reputifly.setRoute(rt); window.__reputifly.forceRender();
      const vw = window.innerWidth;
      const over = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('.drawer')) return;                 // off-canvas by design
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const b = el.getBoundingClientRect();
        if (b.width > 24 && b.height > 0 && b.right > vw + 1) {
          over.push((el.tagName + '.' + (typeof el.className === 'string' ? el.className : '')).slice(0, 50) + ' right=' + Math.round(b.right));
        }
      });
      return { vw, scrollW: document.documentElement.scrollWidth, over: over.slice(0, 4) };
    }, route);
    await page.waitForTimeout(150);
    check(r.scrollW <= r.vw + 1, `${route}: no horizontal page scroll (${r.scrollW} vs ${r.vw})`);
    check(r.over.length === 0, `${route}: nothing overflows the right edge${r.over.length ? ' — ' + r.over.join(', ') : ''}`);
  }

  // Library: the description must actually be visible
  const lib = await page.evaluate(() => {
    window.__reputifly.setRoute('library'); window.__reputifly.forceRender();
    const cell = document.querySelector('#library-list .list-row.lib-row .list-cell-client');
    const name = cell && cell.querySelector('.client-name');
    const kebab = document.querySelector('#library-list .list-row.lib-row .list-cell-actions .icon-btn');
    return {
      cellW: cell ? Math.round(cell.getBoundingClientRect().width) : 0,
      nameText: name ? name.textContent.trim() : '',
      kebab: kebab ? { w: Math.round(kebab.getBoundingClientRect().width), h: Math.round(kebab.getBoundingClientRect().height), right: Math.round(kebab.getBoundingClientRect().right) } : null,
      vw: window.innerWidth
    };
  });
  check(lib.cellW > 120, `library description column has real width (${lib.cellW}px)`);
  check(lib.nameText.length > 0, `library item name is rendered ("${lib.nameText.slice(0, 28)}")`);
  check(lib.kebab && lib.kebab.right <= lib.vw + 1, `library actions button is on-screen (right=${lib.kebab && lib.kebab.right} vs ${lib.vw})`);
  check(lib.kebab && lib.kebab.w >= 44 && lib.kebab.h >= 44, `library actions button is a 44px tap target (${lib.kebab && lib.kebab.w}x${lib.kebab && lib.kebab.h})`);

  // Terms picker: comfortable to tap
  const picker = await page.evaluate(() => {
    const R = window.__reputifly, st = R.getState();
    st.settings.defaultTerms = { title: 'T', subtitle: 'S', sections: [
      { id: 'a', heading: 'Acceptance of Terms and Proposal', body: 'x' },
      { id: 'b', heading: 'Meta Ads Management', body: 'y' }
    ]};
    R.setRoute('creation'); R.forceRender();
    const rows = Array.from(document.querySelectorAll('#creation-wrap .terms-pick'));
    return rows.map(l => {
      const b = l.getBoundingClientRect();
      const cb = l.querySelector('input[type=checkbox]');
      const cbb = cb && cb.getBoundingClientRect();
      return { h: Math.round(b.height), cbW: cbb ? Math.round(cbb.width) : 0, cbH: cbb ? Math.round(cbb.height) : 0 };
    });
  });
  check(picker.length >= 2, `terms picker renders one row per section (${picker.length})`);
  check(picker.every(p => p.h >= 44), `terms rows are >=44px tall (${picker.map(p => p.h).join(', ')})`);
  check(picker.every(p => p.cbW >= 20 && p.cbH >= 20), `terms checkboxes are >=20px (${picker.map(p => p.cbW + 'x' + p.cbH).join(', ')})`);

  // list row kebabs (drafts/paid) also tappable
  const rowKebab = await page.evaluate(() => {
    window.__reputifly.setRoute('invoices'); window.__reputifly.forceRender();
    const k = document.querySelector('#invoices-list .list-row .list-cell-actions .icon-btn');
    if (!k) return null;
    const b = k.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height) };
  });
  check(rowKebab && rowKebab.w >= 44 && rowKebab.h >= 44, `paid-list row menu is a 44px tap target (${rowKebab && rowKebab.w}x${rowKebab && rowKebab.h})`);
  await mob.close();

  // ---------------- DESKTOP (must be unchanged) ----------------
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await desk.newPage();
  dp.on('pageerror', e => bad('desktop pageerror: ' + e.message));
  await dp.goto(`http://127.0.0.1:${PORT}/index.html?dev=1`);
  await dp.waitForFunction(() => window.__reputifly && window.__reputifly.isDev);
  await dp.waitForTimeout(400);
  const deskLib = await dp.evaluate(() => {
    window.__reputifly.setRoute('library'); window.__reputifly.forceRender();
    const row = document.querySelector('#library-list .list-row.lib-row');
    const cols = row ? getComputedStyle(row).gridTemplateColumns.split(' ').length : 0;
    const qty = row ? getComputedStyle(row.children[1]).display : 'none';
    return { cols, qty };
  });
  check(deskLib.cols === 5, `desktop library still shows all 5 columns (${deskLib.cols})`);
  check(deskLib.qty !== 'none', 'desktop library still shows Qty/Rate');
  await desk.close();

  await browser.close();
  server.close();
  console.log(failed ? `\nX ${failed} failure(s)` : '\nOK all mobile checks passed');
  process.exit(failed ? 1 : 0);
})();
