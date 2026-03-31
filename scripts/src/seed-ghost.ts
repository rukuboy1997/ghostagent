import { db, agentsTable, agentActionsTable, memoryEntriesTable, marketplaceListingsTable } from "@workspace/db";
import crypto from "crypto";

function generateAgentId(): string {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

function generateTeeProof(): string {
  return "tee_" + crypto.randomBytes(32).toString("hex");
}

async function seed() {
  console.log("Seeding GhostAgent data...");

  const seedAgents = [
    {
      name: "Alpha Ghost",
      description: "High-frequency DeFi trading agent optimized for arbitrage across 0G Chain protocols",
      personality: "aggressive",
      status: "active",
      agentId: generateAgentId(),
      reputationScore: 87.4,
      totalActions: 234,
      successRate: 0.956,
      capabilities: ["trading", "analysis"],
      isPrivate: true,
      teeVerified: true,
    },
    {
      name: "Phantom Protocol",
      description: "Balanced multi-strategy agent handling DeFi, social presence, and automated payments",
      personality: "balanced",
      status: "idle",
      agentId: generateAgentId(),
      reputationScore: 73.2,
      totalActions: 156,
      successRate: 0.942,
      capabilities: ["trading", "social", "payments"],
      isPrivate: true,
      teeVerified: true,
    },
    {
      name: "Shadow Yield",
      description: "Conservative yield optimization agent focused on low-risk staking and LP positions",
      personality: "conservative",
      status: "active",
      agentId: generateAgentId(),
      reputationScore: 61.8,
      totalActions: 89,
      successRate: 0.978,
      capabilities: ["trading", "payments"],
      isPrivate: false,
      teeVerified: true,
    },
  ];

  const [agent1, agent2, agent3] = await db.insert(agentsTable).values(seedAgents).returning();
  console.log("Agents seeded:", agent1.id, agent2.id, agent3.id);

  const actions = [
    {
      agentId: agent1.id,
      type: "trade",
      title: "ETH/USDC Arbitrage Execution",
      description: "Detected 1.8% spread between 0G DEX and external feed",
      status: "completed",
      result: "Swap executed: 2.5 ETH → 4,233.75 USDC. Net profit: +$76.20 (+1.83%)",
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      gasUsed: "0.000284 ETH",
      teeProof: generateTeeProof(),
      isPrivate: true,
      value: "+$76.20",
    },
    {
      agentId: agent1.id,
      type: "analysis",
      title: "0G Chain Market Scan",
      description: "Full protocol sweep across 12 DeFi markets",
      status: "completed",
      result: "3 arbitrage opportunities identified. Best: WBTC/ETH at 2.3% spread. Confidence: 92.1%",
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      gasUsed: "0.000021 ETH",
      teeProof: generateTeeProof(),
      isPrivate: false,
      value: null,
    },
    {
      agentId: agent2.id,
      type: "social_post",
      title: "Community Engagement Post",
      description: "Scheduled post about 0G ecosystem growth",
      status: "completed",
      result: "Post published to 2 platforms. 1,247 impressions in 24h. Engagement rate: 4.2%",
      txHash: null,
      gasUsed: null,
      teeProof: generateTeeProof(),
      isPrivate: false,
      value: null,
    },
    {
      agentId: agent2.id,
      type: "payment",
      title: "Subscription Auto-Renewal",
      description: "Monthly subscription payment to protocol",
      status: "completed",
      result: "Payment of 0.025 ETH sent. Confirmed in block #8,471,293. Fee: 0.000021 ETH",
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      gasUsed: "0.000021 ETH",
      teeProof: generateTeeProof(),
      isPrivate: true,
      value: "0.025 ETH",
    },
    {
      agentId: agent3.id,
      type: "trade",
      title: "Yield Farming Deposit",
      description: "Capital deployment to 0G liquidity pool",
      status: "completed",
      result: "500 USDC deposited to 0G-ETH pool. Current APY: 18.4%. LP tokens received: 498.2 LP",
      txHash: "0x" + crypto.randomBytes(32).toString("hex"),
      gasUsed: "0.000156 ETH",
      teeProof: generateTeeProof(),
      isPrivate: true,
      value: "$500 USDC",
    },
  ];

  await db.insert(agentActionsTable).values(actions);
  console.log("Actions seeded");

  const memoryEntries = [
    { agentId: agent1.id, category: "preference", key: "risk_tolerance", value: "HIGH - max drawdown 15%", confidence: 0.98, isEncrypted: false },
    { agentId: agent1.id, category: "strategy", key: "primary_strategy", value: "***ENCRYPTED***", confidence: 0.95, isEncrypted: true },
    { agentId: agent1.id, category: "financial_history", key: "best_trade", value: "ETH arbitrage +$341.20 on 2025-03-15", confidence: 1.0, isEncrypted: false },
    { agentId: agent2.id, category: "preference", key: "risk_tolerance", value: "MEDIUM - max drawdown 8%", confidence: 0.97, isEncrypted: false },
    { agentId: agent2.id, category: "social", key: "posting_schedule", value: "Tues/Thurs 14:00 UTC", confidence: 0.92, isEncrypted: false },
    { agentId: agent2.id, category: "behavior_pattern", key: "active_hours", value: "***ENCRYPTED***", confidence: 0.88, isEncrypted: true },
    { agentId: agent3.id, category: "preference", key: "risk_tolerance", value: "LOW - max drawdown 3%", confidence: 0.99, isEncrypted: false },
    { agentId: agent3.id, category: "financial_history", key: "total_yield_earned", value: "$2,847.50 YTD", confidence: 1.0, isEncrypted: false },
  ];

  await db.insert(memoryEntriesTable).values(memoryEntries);
  console.log("Memory entries seeded");

  const marketplaceListings = [
    {
      agentId: agent1.id,
      agentName: "Alpha Ghost",
      description: "Battle-tested arbitrage bot with 87.4% reputation score. Proven across 234+ executions.",
      strategy: "Multi-venue arbitrage with TEE-sealed execution parameters",
      price: "0.1 ETH/month",
      reputationScore: 87.4,
      successRate: 0.956,
      category: "trading",
      isVerified: true,
      rentals: 47,
    },
    {
      agentId: agent2.id,
      agentName: "Phantom Protocol",
      description: "All-in-one agent handling DeFi, social, and payments. Perfect for full automation.",
      strategy: "Balanced multi-strategy with adaptive risk management",
      price: "0.05 ETH/month",
      reputationScore: 73.2,
      successRate: 0.942,
      category: "all_in_one",
      isVerified: true,
      rentals: 28,
    },
    {
      agentId: agent3.id,
      agentName: "Shadow Yield",
      description: "Capital-preserving yield optimizer. Low risk, consistent returns. Ideal for passive income.",
      strategy: "Conservative LP and staking rotation with downside protection",
      price: "0.03 ETH/month",
      reputationScore: 61.8,
      successRate: 0.978,
      category: "trading",
      isVerified: false,
      rentals: 15,
    },
  ];

  await db.insert(marketplaceListingsTable).values(marketplaceListings);
  console.log("Marketplace listings seeded");

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
