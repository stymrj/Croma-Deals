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

const { PRESETS, PRICE_BANDS, inBand, DISC_STEPS, specsOf } = grab('  const PRESETS = {', '\n  const specs', 'PRESETS, PRICE_BANDS, inBand, DISC_STEPS, specsOf');
const { SORTS } = grab('  const score = p =>', '\n  function filtered', 'SORTS');
const specs = p => specsOf(p.title);

check('price bands cover budget to premium electronics', PRICE_BANDS.u1k[2] === 1000 && PRICE_BANDS.o60k[1] === 60000 && PRICE_BANDS.o60k[2] === 0);
check('inBand edges: ₹5,000 is in ₹1k–₹5k, not ₹5k–₹15k', inBand({ price: 5000 }, 'b5k') && !inBand({ price: 5000 }, 'b15k') && inBand({ price: 90000 }, 'o60k') && inBand({ price: 1 }, ''));
check('specs read from electronics titles', JSON.stringify(specsOf('Samsung 138 cm (55 inch) 4K Ultra HD Smart QLED TV')) === '["55 inch","4K","QLED"]'
  && JSON.stringify(specsOf('OnePlus Nord 5G (8GB RAM, 128GB)')) === '["8GB RAM","128GB","5G"]'
  && JSON.stringify(specsOf('LG 1.5 Ton 5 Star Inverter Split AC')) === '["1.5 Ton"]'
  && JSON.stringify(specsOf('Samsung 7 kg Front Load Washing Machine')) === '["7 kg"]');
check('no generic sliders left for discount / price', !/data-in="(minDisc|maxPrice)"/.test(src) && /data-act="mindisc"/.test(src) && /data-act="band"/.test(src));
check('saved off-step discount snaps down to a pill', (() => { const store = { minDisc: 35 }; eval(extractFn(src, '  if (!DISC_STEPS', '\n')); return store.minDisc === 30 && DISC_STEPS.includes(30); })());
check('no grocery unit-price preset or sort', !PRESETS.value && !SORTS.unit);

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
S.spec = '55 inch'; check('55 inch spec chip', ids() === 'tv');
S.spec = '';
S.brand = 'Dell'; check('brand filter works on Best deals too', (S.tab = 'best', ids() === 'lap')); S.tab = 'all';
check('brand counts ignore the brand filter', filtered('brand').length === 4);
S.brand = '';
S.cat = 'Accessories'; S.tab = 'best'; check('category filter applies outside All deals', ids() === 'buds,cable'); S.tab = 'all'; S.cat = '';
S.preset = 'save5k'; check('Save ₹5,000+ quick pick', ids() === 'tv,lap');
S.preset = 'save10k'; check('Save ₹10,000+ quick pick', ids() === 'tv,lap');
S.preset = 'save2k'; check('Save ₹2,000+ quick pick', ids() === 'buds,tv,lap');
S.preset = 'drops'; check('Price drops preset', ids() === 'buds');
S.preset = '';
S.q = 'dell'; check('search matches brand', ids() === 'lap');
S.q = '';
store.sort = 'unit'; check('old saved "unit" sort falls back safely', ids() === 'buds,cable,tv,lap');
store.sort = 'disc';

const mv = extractFn(src, '  function mainView() {', '\n  function drawer');
check('brand, category and spec controls render in the results bar', /data-in="brand"/.test(mv) && /data-in="cat"/.test(mv) && /data-act="spec"/.test(mv) && /data-act="clearf"/.test(mv));
check('preset chips are rendered in the results view', /data-act="preset" data-id="\$\{k\}"/.test(extractFn(src, '  function mainView() {', '\n  function drawer')));

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
  console.log('PASS: price bands, discount pills, spec/brand/category filters, quick picks, Stop and rate-limit handling');
})();
