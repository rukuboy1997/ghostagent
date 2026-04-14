# GhostAgent

## Overview

GhostAgent is a privacy-first autonomous AI agent platform. Users create AI twins ("agents") that execute financial, social, and on-chain actions on their behalf using verifiable secure execution (TEE simulation). Built for the 0G AI × Web3 Hackathon.

## Stack

- **Monorepo tool**: npm workspaces
- **Node.js version**: 24
- **Package manager**: npm
- **Language**: JavaScript (JSX for React components)
- **Frontend**: React + Vite (artifacts/ghost-agent) — dark hacker aesthetic, mobile-responsive
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (server), Vite (frontend)
- **Routing**: Wouter (frontend)
- **Animations**: Framer Motion
- **Icons**: Lucide React

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── ghost-agent/        # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
│   └── src/
│       └── seed-ghost.js   # Seed script for GhostAgent data
```

## Key Features

1. **Agent Creation** — Create unique AI agents with name, personality (aggressive/balanced/conservative), capabilities, and privacy settings
2. **AI Chat Interface** — Real-time chat with your agent using 0G Compute AI inference (falls back to pattern-matching when keys not set)
3. **Autonomous Actions** — Execute trades, social posts, payments, negotiations, and analysis actions
4. **Long-Term Memory** — Memory persisted on 0G Storage with real storage TX hashes and StorageScan explorer links
5. **Reputation System** — On-chain reputation score with ranks (ghost → shadow → specter → phantom → wraith)
6. **Agent Marketplace** — Browse and rent agent strategies from other users
7. **Platform Dashboard** — Real-time stats from live 0G testnet (block number, chain ID), ChainScan/StorageScan explorer links
8. **Mobile-Responsive Layout** — Hamburger menu on mobile, full horizontal nav on desktop

## 0G Integration

GhostAgent is aligned with the **0G APAC Hackathon** — Track 2 (Agentic Trading Arena) + Track 3 (Agentic Economy).

### Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `ZEROG_PRIVATE_KEY` | 0G Chain agent registration + 0G Storage upload signing | For real on-chain storage |
| `ZEROG_COMPUTE_ENDPOINT` | 0G Compute API endpoint URL | For real AI inference |
| `ZEROG_COMPUTE_API_KEY` | 0G Compute authentication key | For real AI inference |
| `ZEROG_COMPUTE_MODEL` | Model name for 0G Compute (default: `llama-3.1-70b-instruct`) | Optional |

All 0G integration features gracefully degrade when env vars are not set — the platform remains fully functional with simulated responses.

### 0G Network (Testnet)

- **RPC**: `https://evmrpc-testnet.0g.ai` (Chain ID: 16602)
- **Storage Indexer**: `https://indexer-storage-testnet-turbo.0g.ai`
- **ChainScan**: `https://chainscan-newton.0g.ai`
- **StorageScan**: `https://storagescan-newton.0g.ai`

### Core 0G Module

`artifacts/api-server/src/lib/zerog.js` — all 0G SDK calls (storage upload, chain tx, compute chat)

## Database Schema

- `agents` — Agent identity, personality, reputation, capabilities
- `agent_actions` — Action execution history with TEE proofs, tx hashes
- `memory_entries` — Agent long-term memory (preferences, history, strategies)
- `marketplace_listings` — Marketplace agent strategy listings

Tables are created via SQL (drizzle-kit push is not used due to npm workspace resolution constraints).

## API Routes

- `GET/POST /api/agents` — List / Create agents
- `GET/PATCH/DELETE /api/agents/:id` — Agent CRUD
- `POST /api/agents/:id/chat` — Chat with agent
- `GET/POST /api/agents/:id/actions` — Actions list / execute
- `GET/POST /api/agents/:id/memory` — Memory entries
- `GET /api/agents/:id/reputation` — Reputation score
- `GET /api/marketplace` — Marketplace listings
- `GET /api/stats/platform` — Platform-wide statistics
- `GET /api/stats/activity` — Recent activity feed
- `GET /api/network/status` — Live 0G network status (block number, chain ID, service availability)

## Development

- `npm run --workspace=artifacts/api-server dev` — Run API server
- `npm run --workspace=artifacts/ghost-agent dev` — Run frontend
- `npm run --workspace=lib/db push` — Push DB schema changes (drizzle.config.js)
