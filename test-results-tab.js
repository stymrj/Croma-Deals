// Regression test (v2): sample API payload -> parser -> cards.
// The fetched items must actually render as cards in the results view:
// parsed count must equal fixture count, and rendered card count must
// equal parsed count. Run: node test-results-tab.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'src', 'deals.js'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-api.json'), 'utf8'));

function extractFn(srcText, startMarker, endMarker) {
  const a = srcText.indexOf(startMarker);
  if (a < 0) throw new Error('not found: ' + startMarker);
  const b = endMarker ? srcText.indexOf(endMarker, a) : srcText.length;
  if (b < 0) throw new Error('end not found for: ' + startMarker);
  return srcText.slice(a, b);
}
// Shared helpers the parser depends on. `const` inside eval() does not leak
// into this scope, so extract the arrow-function expressions and eval them.
const price = eval('(' + extractFn(src, '  const price = ', '\n').slice('  const price = '.length).replace(/;\s*$/, '') + ')');
const guessBrand = eval('(' + extractFn(src, '  const guessBrand = ', '\n').slice('  const guessBrand = '.length).replace(/;\s*$/, '') + ')');
eval(extractFn(src, '  function normalise(x, cat) {', '\n  async function fetchPage'));

const pv = eval('(' + extractFn(src, '  const pv = ', '\n').slice('  const pv = '.length).replace(/;\s*$/, '') + ')');
eval(extractFn(src, '  function cromaStock(x) {', '\n  // Pure helper'));
eval(extractFn(src, '  function cromaUnavailableText(t) {', '\n  function normalise'));

// Stubs for card().
const $inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = () => '';
const spark = () => '';
const store = { hist: {}, favs: [], list: {} };
eval(extractFn(src, '  function card(p, fav, qtyMap) {', '\n  const byDisc'));

const parsed = fixture.products.map(x => normalise(x, 'Televisions')).filter(Boolean);
console.log('Fixture items:', fixture.products.length);
console.log('Parsed items:', parsed.length);
console.log('First item discount %:', parsed[0].disc, '| price:', parsed[0].price, '| mrp:', parsed[0].mrp);
console.log('First item URL:', parsed[0].url, '| img:', parsed[0].img);
console.log('Number/string price shapes parse:', parsed[3].price === 17999 && parsed[3].mrp === 35999);
console.log('Out-of-stock signals honoured:', parsed[5].inStock === false && parsed[6].inStock === false && parsed[7].inStock === false);
console.log('In-stock items stay in stock:', parsed[0].inStock === true);
console.log('Smart-filter helper:', cromaUnavailableText('Currently Unavailable') === true && cromaUnavailableText('In Stock') === false);
if (parsed.length !== fixture.products.length) { console.log('FAIL: parser dropped items'); process.exit(1); }

parsed[0].lowEver = true; parsed[1].was = 999;
const html = parsed.map(p => card(p, false, {})).join('');
const cards = (html.match(/<article class="card/g) || []).length;
console.log('Cards rendered:', cards);
console.log('Contains first product URL?', html.includes('/test-tv-1/p/CRM0001'));
console.log('Out-of-stock card marked oos?', html.includes('card oos'));
console.log('Lowest-ever badge renders?', html.includes('Lowest ever'));
console.log('Price-drop badge renders?', html.includes('Price drop'));
if (cards === parsed.length) {
  console.log('PASS: all ' + parsed.length + ' cards render');
} else {
  console.log('FAIL: expected ' + parsed.length + ' cards, got ' + cards);
  process.exit(1);
}

// --- v2 layer: diagnostics, JSON export, in-browser self-test ---
eval(extractFn(src, '  function diagnoseEmpty(diag, opts) {', '\n  function diagView'));
eval(extractFn(src, '  function jsonExport(list) {', '\n  function listText'));
const S = { selfTest: null };
function toast(m) { console.log('toast:', m); }
function render() {}
eval(extractFn(src, '  function runSelfTest() {', '\n  // ─'));

const diagRate = diagnoseEmpty({ errors: [], emptyJobs: 0, totalJobs: 3, rateLimited: true, auth: false }, { platform: 'Test' });
const diagAuth = diagnoseEmpty({ errors: [], emptyJobs: 0, totalJobs: 3, rateLimited: false, auth: true }, { platform: 'Test' });
const diagEmpty = diagnoseEmpty({ errors: [], emptyJobs: 3, totalJobs: 3, rateLimited: false, auth: false }, { platform: 'Test' });
console.log('Diagnostics rate-limited?', diagRate.some(r => r.indexOf('Rate-limited') === 0));
console.log('Diagnostics signed-out?', diagAuth.some(r => r.indexOf('signed out') >= 0));
console.log('Diagnostics all-empty?', diagEmpty.some(r => r.indexOf('Every category came back empty') === 0));

const diagPin = diagnoseEmpty({ errors: [], emptyJobs: 1, totalJobs: 1, rateLimited: false, auth: false }, { platform: 'Croma', pincodeSaved: false });
console.log('Diagnostics no-pincode?', diagPin.some(r => r.indexOf('No pincode') === 0));
if (!diagPin.some(r => r.indexOf('No pincode') === 0)) { console.log('FAIL: pincode diagnostic missing'); process.exit(1); }

if (!diagRate.some(r => r.indexOf('Rate-limited') === 0) || !diagAuth.some(r => r.indexOf('signed out') >= 0) || !diagEmpty.some(r => r.indexOf('Every category came back empty') === 0)) {
  console.log('FAIL: diagnostics missing a reason');
  process.exit(1);
}
const exported = JSON.parse(jsonExport(parsed));
console.log('JSON export items:', exported.length, '| first discount:', exported[0].discount);
if (exported.length !== parsed.length || exported[0].discount !== parsed[0].disc) {
  console.log('FAIL: JSON export mismatch');
  process.exit(1);
}
const selfTest = runSelfTest();
console.log('In-browser self-test:', selfTest.pass ? 'PASS' : 'FAIL', '-', selfTest.summary);
if (!selfTest.pass) { console.log('FAIL: self-test failed:', selfTest.detail); process.exit(1); }
console.log('PASS: diagnostics + JSON export + self-test');
