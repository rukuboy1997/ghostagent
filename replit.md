# GhostAgent — Alpaca Options Alpha Agent

## Overview

GhostAgent is an autonomous AI options agent for Alpaca's paper-trading environment. It uses DeepSeek-R1 through Cloudflare Workers AI with Alpaca historical bars and options contracts to find high-conviction long call/put setups, enforce risk gates, optionally place capped paper orders, and explain every decision for a hackathon demo.

## Tech Stack

- Frontend: React 19 + Vite + Tailwind v4, Clerk auth, TanStack Query
- Backend: Express.js + Clerk middleware, PostgreSQL, Drizzle ORM
- AI: Cloudflare Workers AI (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`)
- Market data: Alpaca Market Data API (historical IEX bars and latest trades)
- Execution: Alpaca Trading API v2 (paper account, options contracts, orders, positions)

## Product Contract

- Alpaca paper-account equity drives position sizing; the hackathon account target is $100,000.
- AI returns `BUY_CALL`, `BUY_PUT`, or `HOLD` with a thesis, levels, confidence, and an 8-factor confluence score.
- The server selects a real active Alpaca option contract; the model never invents a contract symbol.
- Only long-premium options orders are supported. The autonomous scanner is capped at 1% account risk and 3 contracts.
- Execution requires 78% confidence, 6/8 confluence, an active paper account, buying power, and no unavailable contract.
- The app fails closed when Alpaca or the AI engine is unavailable; it never fabricates a paper order.

## Project Structure

```
artifacts/
  ghost-agent/    # React frontend
    src/pages/    # dashboard, research lab, execution, Alpaca, watchlist, journal
  api-server/     # Express API
    src/routes/    # auth, signals, trading, Alpaca, watchlist
    src/lib/       # alpaca adapter, autonomous scanner, AI adapter, logger
    src/db/        # schema, index, migrations
```

## Supported Underlyings

SPY, QQQ, AAPL, MSFT, NVDA, AMD, TSLA, AMZN, META, and GOOGL.

## Required Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk frontend publishable key |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI token |
| `ALPACA_API_KEY` | Alpaca paper API key |
| `ALPACA_API_SECRET` | Alpaca paper API secret |
| `ALPACA_API_ENDPOINT` | Paper trading endpoint, normally `https://paper-api.alpaca.markets/v2` |

## Database

The trading tables retain historical compatibility columns while the active application writes Alpaca order IDs and option metadata: option symbol, type, strike, expiration, premium, risk levels, AI reasoning, confidence, and confluence factors. Migrations run automatically at startup and are non-destructive.

## Build Notes

- Health endpoint `/api/healthz` is mounted before Clerk middleware.
- Alpaca requests are server-side only and use the IEX feed for historical bars.
- The server is bundled with esbuild.
- The old broker and market-data adapters are intentionally not part of the active application.