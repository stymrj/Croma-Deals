// Regression test: electronics filters and scan Stop.
// - Electronics price bands (₹1k–₹5k … above ₹60k) and discount pills replace the generic sliders.
// - Spec chips read from titles (55 inch, 8GB RAM, 1.5 Ton); brand/category counts ignore their own filter.
// - Quick-pick chips are rendered and filter; search matches the brand.
// - Stop ends a failing fetch at once instead of waiting out the retries; repeated 429 reports rate-limited.
// Run: node test-filters.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'deals.js'), 'utf8');

function extractFn(srcText, startMarker, endMarker) {
  const a = srcText.indexOf(startMarker);
  if (a < 0) throw new Error('not found: ' + startMarker);
  const b = endMarker ? srcText.indexOf(endMarker, a) : srcText.length;
  if (b < 0) throw new Error('end not found for: ' + startMarker);
  return srcText.slice(a, b);
}
// `const` declared inside eval() stays inside it, so return what we need.
const grab = (start, end, names) => eval('(() => {' + extractFn(src, start, end) + '\n; return {' + names + '}; })()');
let fail = 0;
const check = (name, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) fail = 1; };

const { PRICE_BANDS, inBand, DISC_STEPS, specsOf } = grab('  // Electronics price bands', '\n  const specs', 'PRICE_BANDS, inBand, DISC_STEPS, specsOf');
const { SORTS } = grab('  const score = p =>', '\n  function filtered', 'SORTS');
const specs = p => specsOf(p.title);

check('price bands cover budget to premium electronics', PRICE_BANDS.u1k[2] === 1000 && PRICE_BANDS.o60k[1] === 60000 && PRICE_BANDS.o60k[2] === 0);
check('inBand edges: ₹5,000 is in ₹1k–₹5k, not ₹5k–₹15k', inBand({ price: 5000 }, 'b5k') && !inBand({ price: 5000 }, 'b15k') && inBand({ price: 90000 }, 'o60k') && inBand({ price: 1 }, ''));
check('specs read from electronics titles', JSON.stringify(specsOf('Samsung 138 cm (55 inch) 4K Ultra HD Smart QLED TV')) === '["55 inch","4K","QLED"]'
  && JSON.stringify(specsOf('OnePlus Nord 5G (8GB RAM, 128GB)')) === '["8GB RAM","128GB","5G"]'
  && JSON.stringify(specsOf('LG 1.5 Ton 5 Star Inverter Split AC')) === '["1.5 Ton"]'
  && JSON.stringify(specsOf('Samsung 7 kg Front Load Washing Machine')) === '["7 kg"]');
check('fractional specs keep their value', JSON.stringify(specsOf('HP Laptop 39.6 cm (15.6 inch)')) === '["15.6 inch"]' && JSON.stringify(specsOf('LG 1.25 Ton AC')) === '["1.25 Ton"]' && JSON.stringify(specsOf('IFB 6.5 kg Washer')) === '["6.5 kg"]'
  && specsOf('Redmi Note 13 (6.67 inch, 8GB RAM)')[0] === '6.67 inch' && specsOf('Galaxy Tab 8.7 inch')[0] === '8.7 inch' && specsOf('Sony 108 cm (43 inch) TV')[0] === '43 inch');
check('price and discount are dropdowns in the results bar, not sliders', !/data-in="maxPrice"/.test(src) && /data-in="band"/.test(src) && /data-in="minDisc"/.test(src));
check('saved off-step discount snaps down to a pill', (() => { const store = { minDisc: 35 }; eval(extractFn(src, '  if (!DISC_STEPS', '\n')); return store.minDisc === 30 && DISC_STEPS.includes(30); })());
check('no grocery unit-price sort', !SORTS.unit);

const products = [
  { id: 'tv', title: 'Samsung 55 inch 4K TV', brand: 'Samsung', cat: 'Televisions', price: 42990, mrp: 89900, disc: 52, save: 46910, inStock: true },
  { id: 'lap', title: 'Inspiron 15 Laptop 8GB RAM', brand: 'Dell', cat: 'Laptops', price: 38990, mrp: 52990, disc: 26, save: 14000, inStock: true },
  { id: 'cable', title: 'Croma USB-C Cable', brand: 'Croma', cat: 'Accessories', price: 299, mrp: 999, disc: 70, save: 700, inStock: true },
  { id: 'buds', title: 'boAt Airdopes Bluetooth', brand: 'boAt', cat: 'Accessories', price: 1299, mrp: 4990, disc: 74, save: 3691, inStock: true, was: 1499 }
];
const S = { products: new Map(products.map(p => [p.id, p])), q: '', brand: '', cat: '', spec: '', preset: '', tab: 'all', favOnly: false, newOnly: false };
const store = { hidden: [], favs: [], stockOnly: true, minDisc: 0, band: '', sort: 'disc' };
const allowed = () => true;
eval(extractFn(src, '  function filtered(skip) {', '\n  // ─'));
const ids = () => filtered().map(p => p.id).join(',');

store.band = 'b60k'; check('₹30k–₹60k band keeps the TV and laptop', ids() === 'tv,lap');
store.band = 'b5k'; check('₹1k–₹5k band keeps the earbuds', ids() === 'buds');
store.band = '';
S.brand = 'Dell'; check('brand filter works on Best deals too', (S.tab = 'best', ids() === 'lap')); S.tab = 'all';
check('brand counts ignore the brand filter', filtered('brand').length === 4);
S.brand = '';
S.cat = 'Accessories'; S.tab = 'best'; check('category filter applies outside All deals', ids() === 'buds,cable'); S.tab = 'all'; S.cat = '';
store.minDisc = 60; check('discount filter keeps 60%+ deals only', ids() === 'buds,cable'); store.minDisc = 0;
S.q = 'dell'; check('search matches brand', ids() === 'lap');
S.q = '';
store.sort = 'unit'; check('old saved "unit" sort falls back safely', ids() === 'buds,cable,tv,lap');
store.sort = 'disc';

const mv = extractFn(src, '  function mainView() {', '\n  function drawer');
check('category, brand, price and discount controls render in one results bar', ['cat', 'brand', 'band', 'minDisc', 'stockOnly'].every(k => mv.includes('data-in="' + k + '"')) && /data-act="clearf"/.test(mv));
check('spec chips and quick picks are gone', !/data-act="(spec|preset)"/.test(src) && !/Quick picks/.test(src));
check('the menu holds tools, not filters', !/data-in="(band|minDisc|stockOnly)"|data-act="(band|mindisc)"/.test(extractFn(src, '  function sidebar() {', '\n  function spark')));
check('Scan starts right away; categories are chosen from the menu', /case 'scan': if \(S\.scanning\) break; sideOpen = false; scan\(\); break;/.test(src) && /case 'pick': openPicker\(\); break;/.test(src));
check('a selected brand/category with 0 matches stays visible in its dropdown', /S\.cat && !cats\.some\(x => x\[0\] === S\.cat\)/.test(mv) && /S\.brand && !brands\.some/.test(mv));
check('first open loads deals instead of opening the picker, only if the panel is still open', /setTimeout\(\(\) => \{ if \(host\.style\.display !== 'none' && !S\.scanning && \(?!S\.products\.size[^}]*\) scan\(\); \}, 300\)/.test(src) && !/setTimeout\(openPicker/.test(src));
check('menu scrim is not hidden by CSS on desktop', !/\.scrim\.side\{display:none/.test(src));
check('reopening after a Croma pincode change rescans', /S\.scanPin = typeof cromaPin === 'function' \? cromaPin\(\) : ''/.test(src) && /S\.scanPin !== cromaPin\(\)\)\)\) scan\(\)/.test(src));
check('Best deals leads with the biggest rupee savings, not ₹4 accessories', /const top = list\.slice\(\)\.sort\(bySave\)/.test(src));
check('Reset clears price, discount and stock filters too', /case 'clearf':[^\n]*store\.band = ''; store\.minDisc = 0; store\.stockOnly = true/.test(src));
{ const cromaStock = eval('(' + extractFn(src, '  function cromaStock(x) {', '\n  // Pure helper').trim() + ')');
  check('Croma item with no stock flags is not available at the pincode', cromaStock({ stockFlag: [] }) === false && cromaStock({ stockFlag: ['SA-E009'] }) === true && cromaStock({}) === null); }

// fetchPage: Stop and rate limit.
const normalise = x => x;
let pins = ['400049'];
const cromaPins = () => pins;
let slept = 0;
const sleep = ms => { slept += ms; return new Promise(r => setTimeout(r, 5)); };
const W = {};
eval(extractFn(src, '  async function fetchPage(job, page, ctl) {', '\n  // ── Smart Filter'));
const job = { code: '997', g: { name: 'Televisions' } };

(async () => {
  let calls = 0;
  const ctl = { stop: false };
  W.fetch = async () => { calls++; ctl.stop = true; throw new Error('network down'); };
  slept = 0;
  const err = await fetchPage(job, 1, ctl).then(() => null, e => e);
  check('Stop during a failing request ends without retry backoff', err && err.message === 'stopped' && calls === 1 && slept === 0);

  calls = 0; slept = 0;
  W.fetch = async () => { calls++; return { status: 429, ok: false }; };
  const r = await fetchPage(job, 1, { stop: false });
  check('repeated HTTP 429 is reported as rate-limited', r.diag === 'rate' && calls === 3 && r.length === 0);

  // Throttled on the first pincode: the next pincode is still tried.
  pins = ['111111', '222222']; calls = 0;
  W.fetch = async url => { calls++; return url.includes('111111') ? { status: 429, ok: false } : { status: 200, ok: true, json: async () => ({ products: [{ id: 'x' }], pagination: { totalPages: 1 } }) }; };
  const r2 = await fetchPage(job, 1, { stop: false });
  check('a later pincode is tried after the first is rate-limited', r2.length === 1 && calls === 4);

  if (fail) { console.log('FAIL: filters / scan regression'); process.exit(1); }
  console.log('PASS: results-bar filters, pincode availability, Stop and rate-limit handling');
})();
