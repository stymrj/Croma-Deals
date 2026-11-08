# Changelog

## v2.0.0 — 2026-11-08

- Fetch + parse rewritten: `api.croma.com` category search kept; `results` / `data.products` response shapes and `totalResults`/`pageSize` page counts now handled.
- Parser accepts price/MRP as `{value}` objects, numbers or formatted strings, and `plpImage`/`images[0]` image shapes; discount always recomputed from price vs MRP.
- Real stock signals: `stockLevelStatus` / `stockStatus` / `available` / `outOfStock` / "Currently Unavailable" text now mark items out of stock (previously every product was treated as available).
- Smart Filter mode added (sidebar, labelled): hides unavailable cards and auto-loads more on Croma listing pages, pausing while menus are used. Deals finder unchanged and still the default.
- User's discount selection preserved: the parser no longer drops below-minimum-discount items; filtering happens at render time.
- Blank-results fix: differently-shaped items no longer dropped; empty scans now explain why (pincode / Min discount / category).
- Minimal Telegram bot added in `bot/` (Node, no dependencies) using the same `api.croma.com` endpoint and pincode.
- Regression test `test-results-tab.js` added (12 sample products, including 3 out-of-stock signals, must parse and render as cards).
- UI shell (filters, saved items, price history, themes, CSV export) unchanged.
- Depth raised: 3 pages per category by default (was 2); parallel scan with progress; de-dupe across pages/categories by product id.
- Empty-state diagnostics: scans now report why 0 results (signed out, rate-limited, failed categories, empty categories, no pincode saved).
- Built-in self-test button (sidebar) runs the parser checks in-browser; the same checks run offline via `node test-results-tab.js`.
- JSON export added alongside CSV; multi-pincode support (comma-separated pincodes in the sidebar; first pincode with results wins per category).
