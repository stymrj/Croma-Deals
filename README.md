# PriceDrop Hunter for Croma — v2

Scans the Croma categories you pick, sorted by discount, and shows the biggest price cuts. It runs in your own browser as a bookmarklet or userscript. Nothing is uploaded and there is no account.

**Live page:** https://stymrj.github.io/Croma-Deals/

## What's new in v2

- **Fetch + parse rewritten (v2):** still uses Croma's own search API (`api.croma.com/searchservices/v1/category/<id>?currentPage=<n>&query=:discount-desc&fields=FULL&channel=WEB&channelCode=<pincode>`), but now also reads `results` / `data.products` response shapes and derives page count from `totalResults`/`pageSize` when `totalPages` is missing.
- **Parser accepts every product shape:** price/MRP as `{value}` objects, plain numbers or formatted strings (`"₹35,999"`), `plpImage` (relative or absolute) or `images[0]`, `url` or `productUrl`. Discount is always recomputed from price vs MRP.
- **Real stock signals (v2):** products are no longer all treated as available. `stockLevelStatus`, `stockStatus`, `available`/`outOfStock` flags and "Currently Unavailable" text now mark items out of stock, and the In-stock-only filter actually filters.
- **Smart Filter mode (new):** a labelled mode in the sidebar — "Hide unavailable + auto-load more". On the Croma listing page it hides cards marked unavailable and keeps clicking Load More as you scroll, pausing for 1 second after any mouse move so the Sort menu is not interrupted. Toggle it in the sidebar or via `window.__CRM__.smartFilter()`; a green badge shows while it runs. The deals finder is unchanged and still the default.
- **Your discount selection is preserved:** items are no longer dropped in the parser for being below the minimum discount — that filter only applies when rendering.
- **Blank-results fix:** the parser no longer drops number/string-priced or differently-shaped items, and an empty scan now says why (check pincode / lower Min discount / try another category) instead of showing a bare "0 products".
- **Telegram bot (new, `bot/`):** minimal Node bot using the same `api.croma.com` endpoint with your pincode from `.env`. See Bot setup below.
- **Regression test:** `node test-results-tab.js` checks 12 sample products (including 3 out-of-stock signals) all parse and render as cards (see Testing).
- **Bookmark name fixed:** the install button now reads **Croma Deals** instead of the generic “PriceDrop Hunter”, so the bookmark you drag to your bookmarks bar is named after this store.

## Why v2 is stronger

- **Reliability:** `api.croma.com` search + retries with exponential backoff, and empty-state diagnostics that say *why* a scan returned nothing (signed out, rate-limited, failed categories, empty categories, no pincode saved). A built-in self-test (sidebar → Self-test) runs the parser on inline samples in your browser, no network needed.
- **Depth:** 3 pages per category by default (was 2), 3 parallel category workers with progress, and de-dupe across pages and categories by product id.
- **Power features the baseline lacks:** lowest-ever + price-drop labels and Telegram alerts, saved-item price tracking with a sparkline, a cross-category "Biggest discounts" row, unit-price / value sort, multi-word search, multi-pincode support (comma-separated pincodes in the sidebar — first pincode with results wins per category), Smart Filter mode (hide unavailable + continuous scroll), and CSV + JSON export.
- **Bot:** scheduled Telegram bot with a price-history state file (dedupe + price-drop + restock alerts, 30-day pruning), not just a latest-deals list.

## Features

- Asks which categories to scan, then shows the biggest discounts first
- Best deals of each category in one swipeable row, with See all
- Ranks by percent off and rupees saved together
- Labels products that are new, cheaper than last time, or at their lowest price ever
- Price history sparkline on every product you have seen before
- Saved items strip showing how much each one dropped since you saved it
- Unit price (per kg, litre or piece) with a value sort
- One-tap presets: under ₹99, 50% off, save ₹100+, price drops, lowest ever, best value
- A setup checklist on first open
- Filters: search, category, brand, maximum price, minimum discount, stock, saved items
- Shopping list with quantities, total and total savings
- CSV export and copy-to-share text
- Grid and list views, light and dark themes, keyboard shortcuts
- Settings, saved items and price history stay in your browser
- **Smart Filter mode (v2):** hide unavailable items + continuous scroll on Croma listing pages

## Install

![Install walkthrough](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.gif)

[Watch the walkthrough video (MP4)](https://stymrj.github.io/PriceDrop-Hunter/media/install-demo.mp4)

**Bookmarklet (desktop).** Run `node build.js`, open `index.html`, and drag the **Croma Deals** button to your bookmarks bar. Open croma.com and click the bookmark.

**Bookmarklet (mobile).** On the install page, tap **Copy mobile loader**. It is a bookmark of about 380 characters that loads the latest version from GitHub Pages, so it fits on any phone. Create a bookmark named **Croma Deals**, paste it as the address, and run it from the address bar on croma.com. The full bookmarklet (about 45 KB, no network needed) is in `dist/bookmarklet.txt`.

**Userscript.** Install `dist/croma-deals.user.js` in Tampermonkey or Violentmonkey. A small Deals button appears on every croma.com page.

## Use

Pick categories in the scan picker, press Scan, and browse Best deals / All deals / Saved. Heart a deal to save it, Add to list to build a shopping list, and use the presets (under ₹99, 50% off, save ₹100+) for one-tap filtering.
 Smart Filter mode (Croma only): open a Croma category/search page, open Hunter, and switch on "Hide unavailable + auto-load more" in the sidebar — unavailable cards disappear and more results keep loading as you scroll.

## Keyboard shortcuts

`/` search, `S` scan or stop, `Esc` close.

## Telegram alerts

Hunter can send new deals, price drops and cheaper saved items to your Telegram.

1. In Telegram, open `@BotFather`, send `/newbot`, and copy the bot token.
2. Open your new bot and press **Start**.
3. Get your chat ID from `@userinfobot`, or open `https://api.telegram.org/bot<token>/getUpdates` and copy `chat.id`.
4. On the store, open Hunter, press **Telegram** in the top bar, paste the token and chat ID, press **Send test**, then switch alerts on.

Each deal is sent once, and again only if its price drops further. Use the userscript for alerts: some shops block bookmarklets from calling Telegram, while the userscript sends through `GM_xmlhttpRequest`. The token is stored only in your browser.

## Bot setup (Telegram alerts, v2)

A minimal scheduled Node bot lives in `bot/` (no dependencies, Node 18+). It scans the same categories with the same `api.croma.com` endpoint and your pincode, and sends new deals, price drops and restocks to Telegram. It does not include Smart Filter mode (that only makes sense in a browser).

```bash
cp .env.example .env   # fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CROMA_PINCODE
node bot/run.js --dry-run   # prints what would be sent, sends nothing
node bot/run.js             # live run
```

Get the token from `@BotFather` (`/newbot`) and the chat ID from `@userinfobot`. The bot needs your own token — nothing is pre-configured. State is kept in `data/state.json` (created on first run).

## How it gets data

Uses Croma's own search API with the pincode Croma saved for you, sorted by discount. Smart Filter mode (see below) works separately on the listing page's own DOM.

## Troubleshooting

- **Blank results / "No deals found":** check your pincode is set on croma.com (Hunter shows it in the menu), lower Min discount, or try another category. The API is undocumented and can change.
- **Everything looks out of stock:** Smart Filter hides unavailable cards on the listing page; in the deals finder, turn off "In stock only" to see them.
- **Smart Filter does nothing:** it only runs on a Croma listing/search page (not inside the Hunter panel). Open a category page, then start it from the sidebar. If Croma changed its page markup (product list id / Load More button), it will need updating — see `smartFilterTick` in `src/deals.js`.
- **Login / location:** set your pincode on croma.com first; Hunter reads the one Croma saved for you (default 400049 if none is saved).

## Testing

```bash
node --check src/deals.js
node --check bot/platform.js bot/core.js bot/run.js
node test-results-tab.js   # regression test: sample payload -> parser -> cards
node build.js              # rebuild dist/ and index.html
```

The regression test uses only the sample payload in `fixtures/sample-api.json` — it proves fetched items render as cards, it does not prove the live Croma API still returns that shape. Live API behaviour still needs a manual browser test on croma.com (see Limitations).

## Limitations

- Croma can change its internal APIs or page markup at any time; the parser reads responses loosely to survive small changes, but a big change can still break scans until the parser is updated.
- Croma blocks pages from loading code or calling Telegram from other sites. Use the full bookmarklet (not the mobile loader), and the userscript for Telegram alerts.
- Stock is read from the API payload; when the payload says nothing about stock, a product is treated as available.
- Live platform APIs could not be fully verified from the machine that built v2 — run a scan in your own browser before relying on it.

## Project layout

```
src/deals.js         the app (one file, no dependencies)
src/index.tpl.html   install page template
build.js             builds dist/ and index.html
bot/                 Telegram bot (Node, no dependencies)
test-results-tab.js  regression test: sample payload -> parser -> cards
fixtures/sample-api.json
favicon.svg
```

Run `node build.js` after any change.

## License

MIT — see `LICENSE`.

---

Made with ♥ by [Satyam Raj](https://www.linkedin.com/in/satyamraj1)
