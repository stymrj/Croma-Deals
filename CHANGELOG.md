# Changelog

## v2.0.0 — 2026-11-08
- Fixed (2026-11-09): install button now reads “Croma Deals” instead of the generic “PriceDrop Hunter”, so the dragged bookmark is named after this store instead of colliding with every other tool.
- Fixed (2026-11-09): highest-discount items no longer vanish — a missing MRP falls back to the struck-through price (`wasPrice` / `strikeThroughPrice` / `oldPrice`) or the payload's own discount %, and `{min,max}` range / zero-value prices parse instead of ₹0. Previously these items computed 0% off and the Min-discount filter hid them. The Telegram bot no longer ends a scan early on a short page (only on the last item's discount).
- Fixed (2026-11-09): scheduled Telegram bot workflow added (`.github/workflows/telegram-bot.yml`, every 30 minutes 08:31–00:01 IST, dry run via workflow_dispatch, dedupe/price-history state cached at `data/state.json`, `CROMA_PINCODE` as a repository variable); `.env` and `data/` are now git-ignored so a local token or run state can't be committed. Docs corrected: install steps now name the **Croma Deals** button, the mobile loader is the full code (about 62 KB, was "about 380 characters" / "45 KB") because Croma blocks cross-site loading, the install-page mock products are electronics (was groceries), and the bot scans `bot/config.json`'s 8 categories (not the browser tool's 13).

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
