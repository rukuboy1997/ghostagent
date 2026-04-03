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
2. **AI Chat Interface** — Real-time chat with your agent, returns AI responses with confidence scores and TEE proofs
3. **Autonomous Actions** — Execute trades, social posts, payments, negotiations, and analysis actions
4. **Long-Term Memory** — 0G Storage-style memory with encrypted entries for sensitive data
5. **Reputation System** — On-chain reputation score with ranks (ghost → shadow → specter → phantom → wraith)
6. **Agent Marketplace** — Browse and rent agent strategies from other users
7. **Platform Dashboard** — Real-time stats, live activity feed, agent overview
8. **Mobile-Responsive Layout** — Hamburger menu on mobile, full horizontal nav on desktop

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

## Development

- `npm run --workspace=artifacts/api-server dev` — Run API server
- `npm run --workspace=artifacts/ghost-agent dev` — Run frontend
- `npm run --workspace=lib/db push` — Push DB schema changes (drizzle.config.js)
