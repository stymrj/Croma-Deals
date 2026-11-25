// Regression test: a toast shown right before render() must stay visible.
// render() rebuilds the whole shadow DOM, including #toast; the Self-test
// button calls toast() then render(), which used to wipe its result.
// Run: node test-toast-render.js
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
const arrow = name => eval('(' + extractFn(src, '  const ' + name + ' = ', '\n').slice(('  const ' + name + ' = ').length).replace(/;\s*$/, '') + ')');

// Parser helpers runSelfTest() needs.
const price = arrow('price'), priceHi = arrow('priceHi'), guessBrand = arrow('guessBrand'), pv = arrow('pv'), esc = arrow('esc');
eval(extractFn(src, '  function cromaStock(x) {', '\n  // Pure helper'));
eval(extractFn(src, '  function cromaUnavailableText(t) {', '\n  function normalise'));
eval(extractFn(src, '  function normalise(x, cat) {', '\n  async function fetchPage'));

// The #toast markup render() writes, evaluated as the real template literal.
const tplStart = src.indexOf('<div class="toast${');
if (tplStart < 0) { console.log('FAIL: render() no longer builds #toast from toast state'); process.exit(1); }
const toastTpl = src.slice(tplStart, src.indexOf('</div>', tplStart) + '</div>'.length);

// Fake shadow root holding a single #toast element.
function makeToastEl(html) {
  const m = html.match(/^<div class="([^"]*)" id="toast">([\s\S]*)<\/div>$/);
  if (!m) throw new Error('unexpected toast markup: ' + html);
  const cls = new Set(m[1].split(/\s+/).filter(Boolean));
  return { textContent: m[2], classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
}
let toastEl = makeToastEl('<div class="toast" id="toast"></div>');
const root = { getElementById: id => (id === 'toast' ? toastEl : null) };

let tt, toastMsg = '', toastUntil = 0;
eval(extractFn(src, '  function toast(msg) {', '\n  async function copy'));
let renders = 0;
// Same effect on #toast as the real render(): replace it with fresh markup.
function render() { renders++; toastEl = makeToastEl(eval('`' + toastTpl + '`')); }

const S = { selfTest: null };
eval(extractFn(src, '  function runSelfTest() {', '\n  // ─'));

const result = runSelfTest();
clearTimeout(tt);
console.log('Self-test:', result.summary, '| renders:', renders);
console.log('Toast after render:', JSON.stringify(toastEl.textContent), '| visible:', toastEl.classList.contains('on'));
if (renders < 1) { console.log('FAIL: runSelfTest() did not re-render'); process.exit(1); }
if (!toastEl.classList.contains('on') || toastEl.textContent !== 'Self-test PASS: ' + result.summary) {
  console.log('FAIL: Self-test toast was wiped by render()');
  process.exit(1);
}

// A toast whose time is up must not come back on the next render.
toastUntil = Date.now() - 1;
render();
console.log('Expired toast after render visible:', toastEl.classList.contains('on'));
if (toastEl.classList.contains('on') || toastEl.textContent !== '') { console.log('FAIL: expired toast re-shown by render()'); process.exit(1); }

// Toast text is escaped when render() rebuilds it.
toast('<b>x</b> & y');
clearTimeout(tt);
render();
if (toastEl.textContent !== '&lt;b&gt;x&lt;/b&gt; &amp; y') { console.log('FAIL: toast text not escaped: ' + toastEl.textContent); process.exit(1); }
console.log('PASS: toast survives render(), expires, and is escaped');
