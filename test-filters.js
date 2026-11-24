// Regression test: electronics filters and scan Stop.
// - Max price slider reaches ₹2,00,000 (it stopped at ₹2,000, hiding most TVs and laptops).
// - Preset chips are rendered and filter; search matches the brand.
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

const { PRESETS, PRICE_STEPS, priceStep } = grab('  const PRESETS = {', '\n  // Price history', 'PRESETS, PRICE_STEPS, priceStep');
const { SORTS } = grab('  const score = p =>', '\n  function filtered', 'SORTS');

check('max price slider reaches ₹2,00,000', PRICE_STEPS[PRICE_STEPS.length - 1] === 200000 && PRICE_STEPS[0] === 0);
check('priceStep maps saved caps to the nearest stop (ties lower)', priceStep(0) === 0 && PRICE_STEPS[priceStep(30000)] === 30000 && PRICE_STEPS[priceStep(1500)] === 1000 && PRICE_STEPS[priceStep(550)] === 500 && PRICE_STEPS[priceStep(1800)] === 2000 && PRICE_STEPS[priceStep(50)] === 500 && priceStep(999999) === PRICE_STEPS.length - 1);
check('saved caps snap to a slider stop on load', src.includes('store.maxPrice = PRICE_STEPS[priceStep(store.maxPrice)]'));
check('sidebar slider uses the price stops', /max="\$\{PRICE_STEPS\.length - 1\}"[^>]*data-in="maxPrice"/.test(src));
check('no grocery unit-price preset or sort', !PRESETS.value && !SORTS.unit);

const products = [
  { id: 'tv', title: 'Samsung 55 inch 4K TV', brand: 'Samsung', cat: 'Televisions', price: 42990, mrp: 89900, disc: 52, save: 46910, inStock: true },
  { id: 'lap', title: 'Inspiron 15 Laptop', brand: 'Dell', cat: 'Laptops', price: 38990, mrp: 52990, disc: 26, save: 14000, inStock: true },
  { id: 'cable', title: 'Croma USB-C Cable', brand: 'Croma', cat: 'Accessories', price: 299, mrp: 999, disc: 70, save: 700, inStock: true },
  { id: 'buds', title: 'boAt Airdopes', brand: 'boAt', cat: 'Accessories', price: 1299, mrp: 4990, disc: 74, save: 3691, inStock: true, was: 1499 }
];
const S = { products: new Map(products.map(p => [p.id, p])), q: '', brand: '', cat: '', preset: '', tab: 'all', favOnly: false, newOnly: false };
const store = { hidden: [], favs: [], stockOnly: true, minDisc: 0, maxPrice: 0, sort: 'disc' };
const allowed = () => true;
eval(extractFn(src, '  function filtered() {', '\n  // ─'));
const ids = () => filtered().map(p => p.id).join(',');

store.maxPrice = 50000;
check('₹50,000 cap keeps the TV and laptop', ids() === 'buds,cable,tv,lap');
store.maxPrice = 0;
S.preset = 'under1k'; check('Under ₹1,000 preset', ids() === 'cable');
S.preset = 'big'; check('Save ₹5,000+ preset', ids() === 'tv,lap');
S.preset = 'drops'; check('Price drops preset', ids() === 'buds');
S.preset = '';
S.q = 'dell'; check('search matches brand', ids() === 'lap');
S.q = '';
store.sort = 'unit'; check('old saved "unit" sort falls back safely', ids() === 'buds,cable,tv,lap');
store.sort = 'disc';

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
  console.log('PASS: electronics filters, presets, brand search, Stop and rate-limit handling');
})();
