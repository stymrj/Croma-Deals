# Telegram bot (v2)

Scheduled Node bot (no dependencies, Node 18+). Scans the categories in
`bot/config.json` (8 categories, 60% off by default, 2 pages per category)
with the same `api.croma.com` endpoint and pincode as the browser tool,
compares with the last run in `data/state.json`, and sends new deals, price
drops and restocks to Telegram. The browser tool covers more categories
(13 groups); the bot's list is the smaller `config.json` set so each
scheduled run stays fast. It does not include Smart Filter mode (that only
makes sense in a browser).

## Setup

```bash
cp .env.example .env   # then fill in TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CROMA_PINCODE
node bot/run.js --dry-run   # prints what would be sent, sends nothing
node bot/run.js             # live run
```

Get the token from `@BotFather` (`/newbot`) and the chat ID from
`@userinfobot`. The bot only needs the values in `.env`; never commit `.env`.

## Scheduling

The schedule runs on GitHub Actions (`.github/workflows/telegram-bot.yml`):
every 30 minutes, 08:31–00:01 IST. Set the repository **Secrets**
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`, the repository **Variable**
`CROMA_PINCODE` (optional; default `400049`), and the repository **Variable**
`BOT_ENABLED` = `true` — scheduled runs stay off until that variable is set.
Preview any time from **Actions → Telegram deal alerts → Run workflow** with
**Print the messages instead of sending them** ticked (dry run); run it again
unticked for a live send. Optional variables: `MIN_DISCOUNT` (default 60),
`THRESHOLDS`, `GROUPS`, `PAGES` (1–5, default 2), `DIGEST_HOUR_IST`
(default 9), `MAX_WORKERS` (default 3), `MAX_ALERTS` (default 40), `RUNNER`.
The previous run's state is cached in `data/state.json` between runs, so
dedupe and price history survive.

Or run it locally on a schedule, for example every morning at 09:00 IST
with cron:

```cron
0 9 * * * cd /path/to/Croma-Deals && node bot/run.js >> bot/run.log 2>&1
```

State lives in `data/state.json`: each deal alerts once, and again only on a
further price drop; restocks alert too. Records older than 30 days are pruned.
