# GhostAgent — MT5 Trading SaaS

GhostAgent is an autonomous AI trading SaaS. Users sign in with Clerk, connect their MT5 broker account via MetaAPI, deposit funds via Flutterwave, and let GhostAgent (powered by Cloudflare Workers AI / Deepseek R1) analyze markets and place trades autonomously.

## Profit Split
- 70% to the user
- 30% to GhostAgent
- After every 3 trades, user must pay GhostAgent's 30% share via Flutterwave to continue trading

## Architecture

### Frontend — `artifacts/ghost-agent`
- React 19 + Vite + Tailwind v4
- Clerk auth (`@clerk/react` v6) — embedded `<SignIn />` component, `useAuth()` hook
- TanStack Query for server state
- Flutterwave React SDK (`flutterwave-react-v3`) for payments
- Pages: Dashboard, Trading, ConnectMT5, Account

### Backend — `artifacts/api-server`
- Express + Clerk middleware (`@clerk/express`)
- Neon PostgreSQL via Drizzle ORM
- Routes:
  - `GET /api/healthz`
  - `POST /api/auth/sync` — register/sync user from Clerk
  - `GET /api/auth/me` — get current user
  - `PATCH /api/auth/me` — update name/currency
  - `POST /api/mt5/connect` — connect MT5 account via MetaAPI
  - `GET /api/mt5/account` — MT5 account info
  - `GET /api/mt5/market/:symbol` — live price data
  - `GET /api/mt5/positions` — open positions
  - `POST /api/trading/analyze` — AI market analysis (Cloudflare Workers AI)
  - `POST /api/trading/execute` — place trade with 70/30 split
  - `POST /api/trading/:tradeId/close` — close trade and calculate profit
  - `GET /api/trading/history` — trade history
  - `GET /api/trading/status` — balance, share gate status
  - `POST /api/payments/verify-deposit` — verify Flutterwave deposit
  - `POST /api/payments/verify-share` — verify GhostAgent share payment
  - `GET /api/payments/history` — payment history

## Key Libraries
- `metaapi.cloud-sdk` — MT5 cloud connection (uses `dists/esm-node/index.mjs` to avoid browser bundle issues; externalized in build.mjs)
- `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` — via Cloudflare Workers AI REST API
- `flutterwave-react-v3` — frontend payment widget

## Environment Variables Required
- `POSTGRES_URL` — Neon database URL
- `CLERK_SECRET_KEY` — Clerk secret key
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key  
- `VITE_CLERK_PUBLISHABLE_KEY` — same, for frontend
- `VITE_API_URL` — API base URL (auto-set by Replit)
- `CLOUDFLARE_ACCOUNT_ID` — for Cloudflare Workers AI (optional, falls back to demo)
- `CLOUDFLARE_API_TOKEN` — for Cloudflare Workers AI (optional)
- `METAAPI_TOKEN` — for live MT5 trading (optional, falls back to demo mode)

## Demo Mode
- If `METAAPI_TOKEN` not set: uses fake account data and simulated prices
- If `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN` not set: uses random fallback analysis

## DB Schema (Neon PostgreSQL, Drizzle ORM)
- `users` — clerkId, email, balance, mt5 creds, trade counters
- `trades` — symbol, type, volume, profit/userProfit/ghostShare, AI reasoning
- `deposits` — Flutterwave tx tracking for deposits and ghost_share payments

## Flutterwave Public Key
`FLWPUBK-878fa54677d7b3dc8a6d40e1ae90ca64-X` (set in Account.jsx)
