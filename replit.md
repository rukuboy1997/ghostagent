# GhostAgent

## Overview

GhostAgent is a privacy-first autonomous AI agent platform. Users create AI twins ("agents") that execute financial, social, and on-chain actions on their behalf using verifiable secure execution (TEE simulation). Built for the 0G AI × Web3 Hackathon.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/ghost-agent) — dark hacker aesthetic
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
│       └── seed-ghost.ts   # Seed script for GhostAgent data
```

## Key Features

1. **Agent Creation** — Create unique AI agents with name, personality (aggressive/balanced/conservative), capabilities, and privacy settings
2. **AI Chat Interface** — Real-time chat with your agent, returns AI responses with confidence scores and TEE proofs
3. **Autonomous Actions** — Execute trades, social posts, payments, negotiations, and analysis actions
4. **Long-Term Memory** — 0G Storage-style memory with encrypted entries for sensitive data
5. **Reputation System** — On-chain reputation score with ranks (ghost → shadow → specter → phantom → wraith)
6. **Agent Marketplace** — Browse and rent agent strategies from other users
7. **Platform Dashboard** — Real-time stats, live activity feed, agent overview

## Database Schema

- `agents` — Agent identity, personality, reputation, capabilities
- `agent_actions` — Action execution history with TEE proofs, tx hashes
- `memory_entries` — Agent long-term memory (preferences, history, strategies)
- `marketplace_listings` — Marketplace agent strategy listings

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

## Seed Data

Run: `pnpm --filter @workspace/scripts run seed-ghost`

Creates 3 pre-built agents (Alpha Ghost, Phantom Protocol, Shadow Yield) with realistic action history, memory entries, and marketplace listings.

## Development

- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/ghost-agent run dev` — Run frontend
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client
- `pnpm --filter @workspace/db run push` — Push DB schema changes
