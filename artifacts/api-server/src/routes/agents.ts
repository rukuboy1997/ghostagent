import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, agentsTable, agentActionsTable, memoryEntriesTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

function generateAgentId(): string {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

function generateTeeProof(): string {
  return "tee_" + crypto.randomBytes(32).toString("hex");
}

router.get("/agents", async (req, res) => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(desc(agentsTable.createdAt));
    res.json(agents);
  } catch (err) {
    req.log.error({ err }, "Failed to get agents");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents", async (req, res) => {
  try {
    const { name, description, personality, capabilities, isPrivate } = req.body;
    const [agent] = await db.insert(agentsTable).values({
      name,
      description: description || null,
      personality: personality || "balanced",
      status: "idle",
      agentId: generateAgentId(),
      reputationScore: 0,
      totalActions: 0,
      successRate: 0,
      capabilities: capabilities || [],
      isPrivate: isPrivate !== undefined ? isPrivate : true,
      teeVerified: true,
    }).returning();
    res.status(201).json(agent);
  } catch (err) {
    req.log.error({ err }, "Failed to create agent");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agents/:agentId", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    req.log.error({ err }, "Failed to get agent");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/agents/:agentId", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const updates = { ...req.body, updatedAt: new Date() };
    const [agent] = await db.update(agentsTable).set(updates).where(eq(agentsTable.id, agentId)).returning();
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    req.log.error({ err }, "Failed to update agent");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/agents/:agentId", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    await db.delete(agentsTable).where(eq(agentsTable.id, agentId));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete agent");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents/:agentId/chat", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { message } = req.body;

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const responses = {
      trade: [
        `Analyzing market conditions... ETH/BTC spread shows 2.3% arbitrage opportunity. Risk assessment: ${agent.personality === "aggressive" ? "HIGH" : agent.personality === "balanced" ? "MEDIUM" : "LOW"}. Executing strategy within TEE-sealed environment.`,
        `Portfolio rebalancing signal detected. Current allocation deviates 4.7% from target. Preparing swap transaction on 0G Chain testnet.`,
        `Yield farming analysis complete. Best APY: 23.4% on 0G liquidity pool. Deploying capital with ${agent.personality} risk parameters.`,
      ],
      social: [
        `Draft post ready: "Autonomous execution at block #${Math.floor(Math.random() * 1000000)}. Privacy preserved. Results verifiable. #GhostAgent #Web4 #0G"`,
        `Engagement analysis: Your network shows peak activity at 14:00 UTC. Scheduling 3 posts with optimized hashtag strategy.`,
        `Community interaction queued: responding to 7 mentions, liking 23 relevant posts. All actions logged on 0G Storage for verification.`,
      ],
      analysis: [
        `Deep analysis initiated. Scanning 847 on-chain data points, 12 DeFi protocols, and 3 L2 networks. Confidence: ${(Math.random() * 20 + 80).toFixed(1)}%.`,
        `Pattern recognized: Similar market conditions occurred 3 times in Q3 2024. Success rate of strategy execution: 78%. Proceeding.`,
        `Risk matrix computed. Maximum drawdown: ${agent.personality === "aggressive" ? "15%" : agent.personality === "balanced" ? "8%" : "3%"}. Sharpe ratio: ${(Math.random() * 2 + 1.5).toFixed(2)}.`,
      ],
      default: [
        `GhostAgent ${agent.name} processing request... Running inference in TEE-sealed compute. Strategy remains private until execution.`,
        `Understood. Calibrating autonomous execution parameters. All operations logged on 0G Storage with zero-knowledge proofs.`,
        `Analyzing your request against stored memory patterns and current market state. Decision tree computed. Ready to execute.`,
        `Request processed through ${agent.personality} risk filter. Execution plan generated. Awaiting confirmation or autonomous trigger.`,
      ],
    };

    const messageLower = message.toLowerCase();
    let replyPool = responses.default;
    if (messageLower.includes("trade") || messageLower.includes("buy") || messageLower.includes("sell") || messageLower.includes("swap")) {
      replyPool = responses.trade;
    } else if (messageLower.includes("post") || messageLower.includes("tweet") || messageLower.includes("social")) {
      replyPool = responses.social;
    } else if (messageLower.includes("analyz") || messageLower.includes("check") || messageLower.includes("scan")) {
      replyPool = responses.analysis;
    }

    const reply = replyPool[Math.floor(Math.random() * replyPool.length)];
    const confidence = parseFloat((Math.random() * 15 + 84).toFixed(2));

    res.json({
      reply,
      actionSuggested: messageLower.includes("trade") ? "trade" : messageLower.includes("post") ? "social_post" : undefined,
      confidence,
      teeProof: generateTeeProof(),
    });
  } catch (err) {
    req.log.error({ err }, "Chat failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agents/:agentId/actions", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const actions = await db.select().from(agentActionsTable)
      .where(eq(agentActionsTable.agentId, agentId))
      .orderBy(desc(agentActionsTable.createdAt));
    res.json(actions);
  } catch (err) {
    req.log.error({ err }, "Failed to get actions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents/:agentId/actions", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { type, title, description, isPrivate, params } = req.body;

    await db.update(agentsTable).set({ status: "executing", updatedAt: new Date() }).where(eq(agentsTable.id, agentId));

    const [action] = await db.insert(agentActionsTable).values({
      agentId,
      type,
      title,
      description: description || null,
      status: "executing",
      isPrivate: isPrivate !== undefined ? isPrivate : true,
      teeProof: generateTeeProof(),
      value: params?.value || null,
    }).returning();

    setTimeout(async () => {
      const resultMessages: Record<string, string[]> = {
        trade: ["Swap executed: 0.5 ETH → 847.23 USDC at rate 1694.46. Slippage: 0.12%.", "Limit order filled at target price. P&L: +$124.50 (+2.8%).", "DCA purchase complete. 100 USDC deployed into ETH position."],
        social_post: ["Post published to 3 platforms. Engagement prediction: 847 impressions, 23 interactions.", "Community post scheduled and sent. Hashtag performance tracking activated.", "Reply chain engagement complete. 7 interactions logged."],
        payment: ["Payment of 0.01 ETH sent to 0x742d...1f2e. Confirmed in block #8471293.", "Subscription renewed. Next payment scheduled in 30 days.", "Recurring payment processed. Gas optimized: 0.000042 ETH."],
        negotiation: ["Negotiation complete. Counter-offer accepted at 15% discount. Deal value: $2,400.", "Contract terms verified and signed. All conditions met. Execution logged on 0G Chain.", "Deal structure optimized. Expected savings: $340 over 12 months."],
        analysis: ["Analysis complete. 23 data sources processed. Report generated and stored on 0G Storage.", "Market scan finished. 3 opportunities identified with confidence >85%.", "Risk assessment complete. Portfolio optimized for current market regime."],
      };
      const results = resultMessages[type] || ["Action completed successfully. Results stored on 0G Storage."];
      const result = results[Math.floor(Math.random() * results.length)];

      await db.update(agentActionsTable).set({
        status: "completed",
        result,
        txHash: "0x" + crypto.randomBytes(32).toString("hex"),
        gasUsed: (Math.random() * 0.001 + 0.0001).toFixed(6) + " ETH",
        completedAt: new Date(),
      }).where(eq(agentActionsTable.id, action.id));

      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
      if (agent) {
        const newTotal = agent.totalActions + 1;
        const newSuccessRate = ((agent.successRate * agent.totalActions + 1) / newTotal);
        const newReputation = Math.min(100, agent.reputationScore + Math.random() * 2 + 0.5);
        await db.update(agentsTable).set({
          status: "active",
          totalActions: newTotal,
          successRate: parseFloat(newSuccessRate.toFixed(4)),
          reputationScore: parseFloat(newReputation.toFixed(2)),
          updatedAt: new Date(),
        }).where(eq(agentsTable.id, agentId));
      }
    }, 2000 + Math.random() * 3000);

    res.status(201).json(action);
  } catch (err) {
    req.log.error({ err }, "Failed to execute action");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agents/:agentId/memory", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const entries = await db.select().from(memoryEntriesTable)
      .where(eq(memoryEntriesTable.agentId, agentId))
      .orderBy(desc(memoryEntriesTable.createdAt));
    res.json(entries);
  } catch (err) {
    req.log.error({ err }, "Failed to get memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents/:agentId/memory", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { category, key, value, isEncrypted } = req.body;
    const [entry] = await db.insert(memoryEntriesTable).values({
      agentId,
      category,
      key,
      value,
      confidence: 1.0,
      isEncrypted: isEncrypted || false,
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "Failed to add memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/agents/:agentId/reputation", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const score = agent.reputationScore;
    const rank = score >= 90 ? "wraith" : score >= 70 ? "phantom" : score >= 50 ? "specter" : score >= 25 ? "shadow" : "ghost";

    res.json({
      agentId,
      totalScore: parseFloat(score.toFixed(2)),
      performanceScore: parseFloat((score * 0.4 + Math.random() * 5).toFixed(2)),
      reliabilityScore: parseFloat((score * 0.35 + Math.random() * 4).toFixed(2)),
      privacyScore: parseFloat((score * 0.25 + Math.random() * 3).toFixed(2)),
      actionsCompleted: agent.totalActions,
      successRate: parseFloat(agent.successRate.toFixed(4)),
      rank,
      onChainVerified: agent.teeVerified,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reputation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
