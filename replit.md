# GhostAgent — AI Trading Signal SaaS

## Overview

GhostAgent is an AI-powered trading signal platform. Users sign in, enter their broker account balance, select a forex/commodity/crypto pair, and receive high-precision BUY/SELL signals with full risk management (entry, stop loss, take profit, lot size). The AI brain is DeepSeek-R1 via Cloudflare Workers AI, with real market data from Alpha Vantage (RSI, MACD, OHLCV candles). After every 3 signals that reach Take Profit, users send GhostAgent's share before receiving more signals.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind v4 (dark cyberpunk theme), Clerk auth, TanStack Query, Flutterwave payments
- **Backend**: Express.js + Clerk middleware, Neon PostgreSQL, Drizzle ORM
- **AI**: Cloudflare Workers AI (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` — DeepSeek-R1)
- **Market Data**: Alpha Vantage API (forex, commodities, crypto — price, RSI, MACD, OHLCV)
- **Payments**: Flutterwave (deposits + Ghost Share)

## Project Structure

```
artifacts/
  ghost-agent/    # React frontend (port from $PORT)
    src/
      pages/      Dashboard.jsx, Signals.jsx, Account.jsx
      components/ Layout.jsx + ui/ (shadcn components)
      lib/        api.js
  api-server/     # Express backend (port 8080)
    src/
      routes/     health, auth, signals (also mounted at /trading), payments
      lib/        cloudflare-ai.js, alphavantage.js, logger.js
      db/         schema (users, trades, deposits), index.js, migrate.js
      middlewares/ clerkProxyMiddleware.js
```

## Key Business Logic

- Users enter their **trading account balance** (their broker balance) for lot size/risk calculation
- AI generates BUY/SELL/HOLD signals with entry, SL, TP, lot size, risk% based on 1-2% account risk
- **Signal Tracking**: Users mark each signal as TP Hit, SL Hit, or Expired
- **Ghost Share Gate**: After 3 signals reach TP, `shareRequired=true` blocks new signals until share is paid
- **Trading Journal**: Users can add notes to each signal for their own records
- Alpha Vantage provides real market data: OHLCV candles, RSI(14), MACD
- Fallback signal generation when Cloudflare AI or Alpha Vantage not configured

## Supported Markets

- **Forex**: EUR/USD, GBP/USD, USD/JPY, USD/CAD, AUD/USD, USD/CHF, NZD/USD, GBP/JPY, EUR/JPY
- **Commodities**: XAU/USD (Gold), XAG/USD (Silver)
- **Crypto**: BTC/USD, ETH/USD

## Required Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Neon PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret (optional — falls back gracefully) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for frontend |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for DeepSeek-R1 AI |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token |
| `ALPHA_VANTAGE_KEY` | Alpha Vantage API key for real market data |

## Database Schema

- `_trading_users`: clerkId, email, balance, tradingBalance, totalTrades, tpSignalsSinceLastShare
- `_trading_trades`: symbol, type, entryPrice, stopLoss, takeProfit, stopLossPips, takeProfitPips, riskRewardRatio, recommendedLotSize, riskPercent, accountBalanceAtSignal, signalStatus (active/tp_hit/sl_hit/expired), journalNote, aiReasoning, forecast, keyLevels
- `_trading_deposits`: deposit and ghost_share payment records

## Build Notes

- `clerkMiddleware()` uses `CLERK_SECRET_KEY` + `VITE_CLERK_PUBLISHABLE_KEY` (fallback if no CLERK_PUBLISHABLE_KEY)
- Health endpoint `/api/healthz` is mounted BEFORE Clerk middleware to avoid auth errors
- DB migrations run automatically at startup via `src/db/migrate.js`
- Alpha Vantage free tier: 25 requests/day, 5/min — indicators fetched in parallel per signal request
- esbuild bundles the server; MetaAPI removed entirely
