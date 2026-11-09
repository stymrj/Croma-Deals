// Croma bot platform: same api.croma.com category search the browser tool
// uses, rewritten for Node. Pincode comes from CROMA_PINCODE (.env).
// Node 18+, no dependencies.
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const price = v => { if (v == null) return 0; if (typeof v === 'number') return v; if (typeof v === 'object') { for (const k of ['discountedPrice', 'value', 'amount', 'min', 'max', 'text', 'defaultValue']) { const p = price(v[k]); if (p > 0) return p; } return 0; } const m = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; };
const priceHi = v => { if (v == null) return 0; if (typeof v === 'number') return v; if (typeof v === 'object') { for (const k of ['value', 'amount', 'max', 'mrp', 'discountedPrice', 'min', 'text', 'defaultValue']) { const p = priceHi(v[k]); if (p > 0) return p; } return 0; } const m = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/); return m ? +m[0] : 0; };
const brandOf = t => (String(t).trim().split(/\s+/)[0] || '').replace(/[^\w&'-]/g, '');
const pv = v => { if (!v || typeof v !== 'object') return v; if (v.value != null && price(v.value) > 0) return v.value; if (v.formattedValue != null && price(v.formattedValue) > 0) return v.formattedValue; return v; };
function cromaStock(x) {
  const st = x.stock || {};
  if (x.outOfStock === true || x.available === false || st.available === false) return false;
  const txt = String(x.stockStatusText || st.stockStatusText || '').toLowerCase();
  if (txt.indexOf('unavailable') >= 0 || txt.indexOf('out of stock') >= 0) return false;
  const status = String(st.stockLevelStatus || x.stockLevelStatus || x.stockStatus || '').toLowerCase();
  if (status === 'outofstock' || status === 'out_of_stock' || status === 'unavailable') return false;
  if (status === 'instock' || status === 'in_stock' || status === 'available') return true;
  if (typeof x.stockLevel === 'number') return x.stockLevel > 0;
  return null;
}
function normalise(x, cat) {
  if (!x || typeof x !== 'object') return null;
  const title = x.name || x.title;
  const sell = price(pv(x.price));
  const mrpRaw = x.mrp != null ? x.mrp : (x.wasPrice != null ? x.wasPrice : (x.strikeThroughPrice != null ? x.strikeThroughPrice : (x.oldPrice != null ? x.oldPrice : (x.price && x.price.mrp))));
  const mrp0 = priceHi(pv(mrpRaw));
  if (!title || !sell) return null;
  let mrp = sell, disc = 0;
  if (mrp0 > sell) { mrp = mrp0; disc = Math.round((mrp - sell) / mrp * 100); }
  else { // No usable MRP: fall back to the payload's own discount % (see src/deals.js).
    const pct = price(x.discount != null ? x.discount : (x.discountPercentage != null ? x.discountPercentage : x.discountPercent));
    if (pct > 0 && pct < 100) { disc = Math.round(pct); mrp = Math.round(sell / (1 - disc / 100)); }
  }
  const id = x.code || x.productCode || x.id;
  if (!id) return null;
  const imgRaw = x.plpImage || (x.images && x.images[0] && (x.images[0].url || x.images[0].src)) || '';
  const img = String(imgRaw).indexOf('/') === 0 ? 'https://www.croma.com' + imgRaw : String(imgRaw).replace(/^http:/, 'https:');
  const rawUrl = x.url || x.productUrl || '';
  const url = rawUrl ? (String(rawUrl).indexOf('http') === 0 ? String(rawUrl) : 'https://www.croma.com' + (String(rawUrl).indexOf('/') === 0 ? rawUrl : '/' + rawUrl)) : '';
  return { id: String(id), title: String(title), brand: String(x.manufacturer || x.brand || brandOf(title)), price: sell, mrp,
    disc, img, url,
    inStock: cromaStock(x) !== false, cat };
}
module.exports = {
  label: 'Croma',
  required: [],
  workers: 3,
  pageSize: 24,
  sortedByDiscount: true,
  async fetchPage(job, page, ctx) {
    const { env, fetch, sleep } = ctx;
    const [code] = job.sub;
    const pin = encodeURIComponent(env.CROMA_PINCODE || '400049');
    const url = 'https://api.croma.com/searchservices/v1/category/' + code + '?currentPage=' + (page - 1) + '&query=' + encodeURIComponent(':discount-desc') + '&fields=FULL&channel=WEB&channelCode=' + pin;
    await sleep(400 + Math.random() * 600);
    for (let a = 0; a < 4; a++) {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA, referer: 'https://www.croma.com/' } });
      if (r.status === 429 || r.status === 503) { await sleep(4000 * (a + 1)); continue; }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Croma refused the request (HTTP ' + r.status + ').'), { blocked: true });
      if (!r.ok) return [];
      const j = await r.json(), pg = j.pagination || {};
      const raw = j.products || j.results || (j.data && j.data.products) || [];
      const items = raw.map(x => normalise(x, job.g.name)).filter(Boolean);
      const totalPages = pg.totalPages || (pg.totalResults && pg.pageSize ? Math.ceil(pg.totalResults / pg.pageSize) : 0);
      items.more = totalPages ? page < totalPages : raw.length > 0;
      return items;
    }
    throw new Error('rate limited');
  }
};
