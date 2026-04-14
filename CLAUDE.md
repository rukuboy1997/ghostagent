# GhostAgent — 0G APAC Hackathon Project

## Project Overview

GhostAgent is a **privacy-first autonomous AI agent platform** built for the 0G APAC Hackathon (Track 2: Agentic Trading Arena + Track 3: Agentic Economy). Users deploy AI "Operatives" that autonomously execute financial trades, manage on-chain identities, and maintain verifiable memory — all backed by real 0G infrastructure.

## 0G Integration Architecture

```
User → GhostAgent UI → Express API
                            ├── 0G Chain    (agent identity registration, tx proofs)
                            ├── 0G Storage  (agent memory, encrypted preferences, execution logs)
                            └── 0G Compute  (AI inference for autonomous decision-making)
```

### 0G Products Used

| Product | Usage | File |
|---------|-------|------|
| **0G Storage** | Agent memory persisted on 0G decentralized storage with `storageRoot` and `storageTx` | `artifacts/api-server/src/lib/zerog.js` |
| **0G Compute** | OpenAI-compatible AI inference for agent chat and autonomous decisions | `artifacts/api-server/src/lib/zerog.js` |
| **0G Chain** | Agent registration as on-chain identity with `chainTxHash` | `artifacts/api-server/src/lib/zerog.js` |

### 0G Network (Testnet)
- **RPC**: `https://evmrpc-testnet.0g.ai` (Chain ID: 16602)
- **Storage Indexer**: `https://indexer-storage-testnet-turbo.0g.ai`
- **ChainScan**: `https://chainscan-newton.0g.ai`
- **StorageScan**: `https://storagescan-newton.0g.ai`

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS + Framer Motion (cyberpunk dark theme)
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL (Neon)
- **0G SDK**: `@0gfoundation/0g-ts-sdk`, `ethers`, `openai`
- **Monorepo**: npm workspaces

## Core Module: `artifacts/api-server/src/lib/zerog.js`

```js
// Upload agent memory to 0G Storage
uploadMemoryToStorage({ agentId, key, value, category })
  // Returns: { storageRoot, storageTx, storageExplorerUrl }

// Register agent identity on 0G Chain
registerAgentOnChain({ agentId, name, personality })
  // Returns: { chainTxHash }

// AI inference via 0G Compute
chatWithAgent(agent, message, memoryEntries)
  // Returns: AI response string | null (falls back to local if not configured)

// Network status
getNetworkStatus()
  // Returns: { connected, chainId, blockNumber, services }
```

## Environment Variables

```bash
# Database (required)
POSTGRES_URL=postgresql://...neon.tech/neondb   # Neon PostgreSQL (Vercel/production)
DATABASE_URL=...                                  # Fallback (Replit dev)

# 0G Network (optional — platform works without these, with graceful fallback)
ZEROG_PRIVATE_KEY=0x...     # Wallet private key for 0G Storage + Chain registration
ZEROG_COMPUTE_ENDPOINT=...  # 0G Compute API endpoint
ZEROG_COMPUTE_API_KEY=...   # 0G Compute API key
ZEROG_COMPUTE_MODEL=llama-3.1-70b-instruct  # Model name (default)
```

## API Routes

```
GET  /api/network/status        → Live 0G network status (block number, chain ID)
GET  /api/agents                → List agents (includes chainRegistered, chainTxHash)
POST /api/agents                → Create agent + register on 0G Chain (async)
POST /api/agents/:id/chat       → Chat via 0G Compute AI (fallback: pattern matching)
GET  /api/agents/:id/actions    → Action history with storageRoot (0G Storage proof)
POST /api/agents/:id/actions    → Execute action + store on 0G Storage
GET  /api/agents/:id/memory     → Memory entries with storageTx (0G Storage proof)
POST /api/agents/:id/memory     → Add memory + upload to 0G Storage
GET  /api/agents/:id/reputation → Agent reputation score + rank
GET  /api/marketplace           → Marketplace agent listings
GET  /api/stats/platform        → Platform-wide statistics
GET  /api/stats/activity        → Recent activity feed
```

## Database Schema

```sql
agents          (id, name, personality, status, agent_id, chain_tx_hash, chain_registered, ...)
agent_actions   (id, agent_id, type, title, status, result, tee_proof, storage_root, ...)
memory_entries  (id, agent_id, category, key, value, is_encrypted, storage_root, storage_tx, ...)
marketplace_listings (id, agent_id, strategy, price, rating, ...)
```

## Deployment

### Backend (Vercel — `artifacts/api-server/`)
```bash
# Required env vars in Vercel project settings:
DATABASE_URL=postgresql://...neon.tech/neondb
ZEROG_PRIVATE_KEY=0x...
ZEROG_COMPUTE_ENDPOINT=https://...
ZEROG_COMPUTE_API_KEY=...
```

### Frontend (Vercel — `artifacts/ghost-agent/`)
```bash
# Required env vars in Vercel project settings:
VITE_API_URL=https://your-api.vercel.app
```

## Live 0G Testnet Proof (Real Transactions)

These transactions were executed live against the 0G Newton testnet during development:

| Event | TX Hash | Explorer |
|-------|---------|----------|
| Agent NEXUS-1 chain registration | `0x8f97843a2b5b7a766a278f1f2349e829d9580395e3db71b897c85b4066ee0368` | [ChainScan](https://chainscan-newton.0g.ai/tx/0x8f97843a2b5b7a766a278f1f2349e829d9580395e3db71b897c85b4066ee0368) |
| Agent SPECTER-X chain registration | `0xd752b48efb3ca2999118b33578d2304c001744ee38b8b467939eea8343ff7aac` | [ChainScan](https://chainscan-newton.0g.ai/tx/0xd752b48efb3ca2999118b33578d2304c001744ee38b8b467939eea8343ff7aac) |
| Memory "BTC_SIGNAL" uploaded to 0G Storage | Root: `0xcab9fecd818fdf0f2a77bcded8544f871d808061973feec5053c3b20f9c5a83c` | [StorageScan](https://storagescan-newton.0g.ai/file/0xcab9fecd818fdf0f2a77bcded8544f871d808061973feec5053c3b20f9c5a83c) |
| Memory upload TX | `0xd87cf3d8c6924d3f6448d5ebba53e6703960720f8832def15b15d6e60685afaa` | [ChainScan](https://chainscan-newton.0g.ai/tx/0xd87cf3d8c6924d3f6448d5ebba53e6703960720f8832def15b15d6e60685afaa) |
| Memory "ALPHA_SIGNAL" uploaded to 0G Storage | Root: `0x0d1ecc2ad7ffea7a0ba255049630a4a0c15bcc8472f8e22b173078f1a9c39716` | [StorageScan](https://storagescan-newton.0g.ai/file/0x0d1ecc2ad7ffea7a0ba255049630a4a0c15bcc8472f8e22b173078f1a9c39716) |

**Wallet**: `0x8209Dc2ab4E92Fe5dc70752883C95b342b83D094` on 0G Newton Testnet (Chain ID: 16602)

## Hackathon Tracks

### Track 2: Agentic Trading Arena
- Agents autonomously execute trade, arbitrage, and analysis strategies
- TEE-sealed execution with attestation proofs stored on 0G Storage
- On-chain transaction hashes viewable on ChainScan

### Track 3: Agentic Economy
- Agents have on-chain identities registered via 0G Chain
- Long-term memory stored on 0G decentralized storage (verifiable)
- Agent marketplace for renting strategies between users
- Reputation system with on-chain score tracking
