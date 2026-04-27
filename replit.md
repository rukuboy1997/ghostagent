# GhostAgent — MT5 AI Trading SaaS

## Overview

GhostAgent is an autonomous AI trading SaaS platform. Users sign up, connect their MetaTrader 5 broker account, deposit minimum $5, and let GhostAgent's AI (Deepseek R1 via Cloudflare Workers AI) autonomously analyze forex/commodity markets and place trades. Profit is split 70% to user / 30% to GhostAgent. After every 3 trades, the user pays GhostAgent's 30% share via Flutterwave to continue.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind v4 (dark cyberpunk theme), Clerk auth, TanStack Query, Flutterwave payments
- **Backend**: Express.js + Clerk middleware, Neon PostgreSQL, Drizzle ORM
- **AI**: Cloudflare Workers AI (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`)
- **MT5**: MetaAPI cloud SDK (demo mode when `METAAPI_TOKEN` not set)
- **Payments**: Flutterwave (NGN, USD, card, USSD)

## Project Structure

```
artifacts/
  ghost-agent/    # React frontend (port from $PORT)
    src/
      pages/      Dashboard.jsx, Trading.jsx, ConnectMT5.jsx, Account.jsx
      components/ Layout.jsx + ui/ (shadcn components)
      lib/        api.js, useAuth.js
  api-server/     # Express backend (port 8080)
    src/
      routes/     health, auth, mt5, trading, payments
      lib/        cloudflare-ai.js, metaapi.js, logger.js
      db/         schema (users, trades, deposits), index.js
      middlewares/ clerkProxyMiddleware.js
```

## Key Business Logic

- Minimum $5 balance to trade
- 70% user / 30% GhostAgent profit split on every closed trade
- After 3 trades, `shareRequired=true` blocks new trades until GhostAgent share is paid
- MetaAPI connects MT5 accounts via cloud (no MT5 client needed)
- Demo mode: when `METAAPI_TOKEN` not set, uses simulated prices and account data

## Required Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Neon PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same, for Vite frontend |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (optional) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (optional) |
| `METAAPI_TOKEN` | MetaAPI token for live MT5 (optional) |

## Build Notes

- `metaapi.cloud-sdk` must be externalized in `build.mjs` AND imported from `dists/esm-node/index.mjs` to avoid webpack browser bundle `window` reference errors
- `@clerk/react` v6 — no `SignedIn`/`SignedOut` exports; use `useAuth()` hook + inline `<SignIn />` component
- DB tables created via raw SQL (no drizzle-kit in artifact); schema matches Drizzle definitions exactly
