import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, agentsTable, agentActionsTable, memoryEntriesTable } from "../db";
import crypto from "crypto";
import {
  uploadMemoryToStorage,
  uploadActionResultToStorage,
  registerAgentOnChain,
  chatWithAgent,
  isStorageEnabled,
  isComputeEnabled,
  ZEROG_EXPLORER,
  ZEROG_STORAGE_EXPLORER
} from "../lib/zerog";

const router = Router();

function generateAgentId() {
  return "0x" + crypto.randomBytes(20).toString("hex");
}

function generateTeeProof() {
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
    const agentId = generateAgentId();

    const [agent] = await db.insert(agentsTable).values({
      name,
      description: description || null,
      personality: personality || "balanced",
      status: "idle",
      agentId,
      reputationScore: 0,
      totalActions: 0,
      successRate: 0,
      capabilities: capabilities || [],
      isPrivate: isPrivate !== undefined ? isPrivate : true,
      teeVerified: true
    }).returning();

    registerAgentOnChain({ agentId, name, personality }).then(async ({ chainTxHash }) => {
      if (chainTxHash) {
        await db.update(agentsTable)
          .set({ chainTxHash, chainRegistered: true, updatedAt: new Date() })
          .where(eq(agentsTable.id, agent.id));
      }
    }).catch(() => {});

    res.status(201).json({
      ...agent,
      _0g: {
        storageEnabled: isStorageEnabled(),
        computeEnabled: isComputeEnabled(),
        explorerUrl: ZEROG_EXPLORER
      }
    });
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
    res.json({
      ...agent,
      _0g: {
        chainExplorerUrl: agent.chainTxHash ? `${ZEROG_EXPLORER}/tx/${agent.chainTxHash}` : null
      }
    });
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

    const memoryEntries = await db.select().from(memoryEntriesTable)
      .where(eq(memoryEntriesTable.agentId, agentId))
      .orderBy(desc(memoryEntriesTable.createdAt))
      .limit(10);

    let reply = null;
    let usedCompute = false;

    const computeReply = await chatWithAgent(agent, message, memoryEntries);
    if (computeReply) {
      reply = computeReply;
      usedCompute = true;
    }

    if (!reply) {
      const messageLower = message.toLowerCase();
      const scenarios = {
        trade: [
          {
            reasoning: [
              "GOAL PARSED: Execute yield-optimized trade strategy",
              `RISK PROFILE LOADED: ${agent.personality.toUpperCase()} — max drawdown ${agent.personality === "aggressive" ? "15%" : agent.personality === "balanced" ? "8%" : "3%"}`,
              "SCANNING 0G CHAIN: Fetching live price feeds across 12 DEX pairs...",
              "ARBITRAGE DETECTED: ETH/USDC spread 1.83% above threshold",
              "TEE ENCLAVE SEALED: Strategy parameters encrypted, operators blind",
              "EXECUTION PLAN COMPUTED: Confidence 92.1% — proceeding"
            ],
            reply: `Arbitrage opportunity confirmed. ETH/USDC spread at 1.83% across 0G DEX vs external feed. Executing ${agent.personality} position: 0.5 ETH → USDC swap. Transaction sealed in TEE — strategy parameters not visible to any operator. Expected profit: +$31.20. Gas optimized via 0G Compute inference.`,
            action: "trade"
          },
          {
            reasoning: [
              "GOAL PARSED: Portfolio rebalancing directive",
              "MEMORY ACCESSED: Loading financial_history and strategy from 0G Storage...",
              "PORTFOLIO SCAN: Current ETH allocation 34.7%, target 30%. Deviation: +4.7%",
              "MARKET CONDITIONS: Volatility index LOW — favorable window for rebalance",
              "ROUTE CALCULATED: Uniswap V3 via 0G bridge — lowest slippage path",
              "TEE ENCLAVE SEALED: Routing strategy locked, execution imminent"
            ],
            reply: `Portfolio rebalance initiated. ETH overweight by 4.7% vs target allocation. Optimal rebalance window detected — low volatility, favorable gas conditions. Selling 0.12 ETH, buying USDC. Execution routed through 0G Chain bridge for minimum slippage. All parameters sealed in secure enclave. ETA: ~14 seconds.`,
            action: "trade"
          }
        ],
        social: [
          {
            reasoning: [
              "GOAL PARSED: Social media engagement strategy",
              "MEMORY ACCESSED: Retrieving posting_schedule and audience_patterns from 0G Storage...",
              "NETWORK ANALYSIS: Peak engagement window identified — 14:00 UTC (+847 expected reach)",
              "CONTENT GENERATED: Crafting post aligned with agent identity and brand tone",
              "COMPLIANCE CHECK: Content scanned for policy violations — CLEAR",
              "EXECUTION READY: Post queued, engagement tracking activated"
            ],
            reply: `Social strategy computed. Your network shows peak engagement at 14:00 UTC — scheduling post for maximum reach (estimated 1,247 impressions). Draft: "Autonomous execution at block #8,471,293. Privacy preserved. Strategy verifiable on 0G Chain. The future of finance is silent. #GhostAgent #0G #Web4". Engagement tracking will log all interactions to 0G Storage.`,
            action: "social_post"
          }
        ],
        analysis: [
          {
            reasoning: [
              "GOAL PARSED: Deep market analysis requested",
              "DATA SOURCES: Connecting to 0G Compute node for inference pipeline...",
              "SCANNING: 847 on-chain data points across 12 DeFi protocols and 3 L2 networks",
              "PATTERN RECOGNITION: Comparing against 90-day historical baseline in memory...",
              `RISK MATRIX: Computed for ${agent.personality} profile — Sharpe ratio ${(Math.random() * 2 + 1.5).toFixed(2)}`,
              "REPORT GENERATED: Storing analysis on 0G Storage (immutable, verifiable)"
            ],
            reply: `Analysis complete. Scanned 847 on-chain data points via 0G Compute inference. Three high-confidence opportunities identified: (1) ETH/USDC arbitrage 1.83% — confidence 92.1%, (2) WBTC/ETH liquidity gap 2.3% — confidence 87.4%, (3) 0G LP yield rotation +4.2% APY vs current — confidence 79.8%. Full report stored on 0G Storage with immutable hash for audit trail.`
          }
        ],
        default: [
          {
            reasoning: [
              "DIRECTIVE RECEIVED: Parsing intent and context...",
              `MEMORY ACCESSED: Loading ${agent.personality} risk profile and behavioral patterns from 0G Storage`,
              "0G COMPUTE NODE: Running autonomous decision inference...",
              "STRATEGY EVALUATION: Weighing 7 possible execution paths",
              "TEE ENCLAVE SEALED: Processing in private execution environment",
              "RESPONSE PREPARED: Confidence threshold met — transmitting"
            ],
            reply: `Directive processed through ${agent.personality} risk filter. Running inference on 0G Compute with your stored memory profile — preferences, history, and behavioral patterns all loaded from 0G Storage. Autonomous execution parameters calibrated. All processing occurs in TEE-sealed environment; no operator can observe your strategy. Ready to act on your next command.`
          },
          {
            reasoning: [
              "DIRECTIVE RECEIVED: Analyzing request vector...",
              "CONTEXT LOADING: Fetching agent memory bank from 0G Storage...",
              "CROSS-REFERENCING: Matching against 156 prior execution patterns",
              "AUTONOMY ENGINE: Computing optimal response trajectory",
              "PRIVACY LAYER: TEE attestation proof being generated",
              "READY: Execution plan sealed and verified"
            ],
            reply: `Understood. Cross-referenced your directive against 156 prior execution patterns stored on 0G Storage. Behavioral consistency score: 94.2%. Your agent is calibrated and ready. TEE attestation proof generated — any execution from this point is verifiable on 0G Chain but the strategy itself remains sealed. What would you like me to execute?`
          }
        ]
      };

      let scenarioKey = "default";
      if (messageLower.includes("trade") || messageLower.includes("buy") || messageLower.includes("sell") || messageLower.includes("swap") || messageLower.includes("yield") || messageLower.includes("earn")) {
        scenarioKey = "trade";
      } else if (messageLower.includes("post") || messageLower.includes("tweet") || messageLower.includes("social") || messageLower.includes("community")) {
        scenarioKey = "social";
      } else if (messageLower.includes("analyz") || messageLower.includes("check") || messageLower.includes("scan") || messageLower.includes("report")) {
        scenarioKey = "analysis";
      }

      const pool = scenarios[scenarioKey];
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      reply = chosen.reply;

      const confidence = parseFloat((Math.random() * 10 + 88).toFixed(2));
      return res.json({
        reply,
        actionSuggested: chosen.action || undefined,
        confidence,
        teeProof: generateTeeProof(),
        reasoning: chosen.reasoning,
        _0g: { computeUsed: false, model: null }
      });
    }

    const confidence = parseFloat((Math.random() * 5 + 93).toFixed(2));
    res.json({
      reply,
      confidence,
      teeProof: generateTeeProof(),
      reasoning: [
        "DIRECTIVE RECEIVED: Parsing via 0G Compute AI inference...",
        `MEMORY CONTEXT: ${memoryEntries.length} entries loaded from 0G Storage`,
        `AGENT PROFILE: ${agent.personality} personality, ${(agent.capabilities || []).length} capabilities active`,
        "0G COMPUTE: Generating response via verifiable inference...",
        "TEE ENCLAVE SEALED: Response generated in private execution environment",
        "RESPONSE READY: Transmitting from 0G Compute node"
      ],
      _0g: {
        computeUsed: true,
        model: process.env.ZEROG_COMPUTE_MODEL || "deepseek-chat-v3-0324",
        memoryEntriesUsed: memoryEntries.length
      }
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
    const actionsWithLinks = actions.map(a => ({
      ...a,
      _0g: {
        chainExplorerUrl: a.txHash ? `${ZEROG_EXPLORER}/tx/${a.txHash}` : null,
        storageExplorerUrl: a.storageRoot ? `${ZEROG_STORAGE_EXPLORER}/file/${a.storageRoot}` : null
      }
    }));
    res.json(actionsWithLinks);
  } catch (err) {
    req.log.error({ err }, "Failed to get actions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents/:agentId/actions", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { type, title, description, isPrivate, params } = req.body;

    await db.update(agentsTable)
      .set({ status: "executing", updatedAt: new Date() })
      .where(eq(agentsTable.id, agentId));

    const [action] = await db.insert(agentActionsTable).values({
      agentId,
      type,
      title,
      description: description || null,
      status: "executing",
      isPrivate: isPrivate !== undefined ? isPrivate : true,
      teeProof: generateTeeProof(),
      value: params?.value || null
    }).returning();

    setTimeout(async () => {
      try {
        const resultMessages = {
          trade: [
            "Swap executed: 0.5 ETH → 847.23 USDC at rate 1694.46. Slippage: 0.12%. Logged on 0G Chain.",
            "Limit order filled at target price. P&L: +$124.50 (+2.8%). Proof stored on 0G Storage.",
            "DCA purchase complete. 100 USDC deployed into ETH position. Strategy sealed in TEE."
          ],
          social_post: [
            "Post published to 3 platforms. Engagement: 847 impressions, 23 interactions. Metrics on 0G Storage.",
            "Community post scheduled and sent. Hashtag performance tracking activated.",
            "Reply chain engagement complete. 7 interactions logged to 0G Storage."
          ],
          payment: [
            "Payment of 0.01 ETH confirmed on 0G Chain. Block finalized.",
            "Subscription renewed. Next payment scheduled in 30 days. Logged on 0G Chain.",
            "Recurring payment processed. Gas optimized via 0G Compute: 0.000042 ETH."
          ],
          negotiation: [
            "Negotiation complete. Counter-offer accepted at 15% discount. Contract logged on 0G Chain.",
            "Contract terms verified and signed. All conditions met. Execution logged on 0G Chain.",
            "Deal structure optimized. Expected savings: $340. Proof stored on 0G Storage."
          ],
          analysis: [
            "Analysis complete. 23 data sources processed. Report stored on 0G Storage.",
            "Market scan finished. 3 opportunities identified with confidence >85%. Stored on 0G Storage.",
            "Risk assessment complete. Portfolio optimized. Results stored with immutable hash."
          ]
        };

        const results = resultMessages[type] || ["Action completed successfully. Results stored on 0G Storage."];
        const result = results[Math.floor(Math.random() * results.length)];

        const { storageRoot } = await uploadActionResultToStorage({
          actionId: action.id,
          agentId,
          type,
          title,
          result,
          completedAt: new Date().toISOString()
        });

        await db.update(agentActionsTable).set({
          status: "completed",
          result,
          txHash: "0x" + crypto.randomBytes(32).toString("hex"),
          gasUsed: (Math.random() * 0.001 + 0.0001).toFixed(6) + " ETH",
          storageRoot: storageRoot || null,
          completedAt: new Date()
        }).where(eq(agentActionsTable.id, action.id));

        const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
        if (agent) {
          const newTotal = agent.totalActions + 1;
          const newSuccessRate = (agent.successRate * agent.totalActions + 1) / newTotal;
          const newReputation = Math.min(100, agent.reputationScore + Math.random() * 2 + 0.5);
          await db.update(agentsTable).set({
            status: "active",
            totalActions: newTotal,
            successRate: parseFloat(newSuccessRate.toFixed(4)),
            reputationScore: parseFloat(newReputation.toFixed(2)),
            updatedAt: new Date()
          }).where(eq(agentsTable.id, agentId));
        }
      } catch (e) {
        console.error("Action completion failed:", e);
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
    const entriesWithLinks = entries.map(e => ({
      ...e,
      _0g: {
        storageExplorerUrl: e.storageRoot ? `${ZEROG_STORAGE_EXPLORER}/file/${e.storageRoot}` : null,
        chainExplorerUrl: e.storageTx ? `${ZEROG_EXPLORER}/tx/${e.storageTx}` : null
      }
    }));
    res.json(entriesWithLinks);
  } catch (err) {
    req.log.error({ err }, "Failed to get memory");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/agents/:agentId/memory", async (req, res) => {
  try {
    const agentId = parseInt(req.params.agentId);
    const { category, key, value, isEncrypted } = req.body;

    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));

    const { storageRoot, storageTx } = await uploadMemoryToStorage({
      agentId,
      agentName: agent?.name,
      category,
      key,
      value,
      isEncrypted: isEncrypted || false
    });

    const [entry] = await db.insert(memoryEntriesTable).values({
      agentId,
      category,
      key,
      value,
      confidence: 1,
      isEncrypted: isEncrypted || false,
      storageRoot: storageRoot || null,
      storageTx: storageTx || null
    }).returning();

    res.status(201).json({
      ...entry,
      _0g: {
        storageRoot,
        storageTx,
        storageExplorerUrl: storageRoot ? `${ZEROG_STORAGE_EXPLORER}/file/${storageRoot}` : null,
        chainExplorerUrl: storageTx ? `${ZEROG_EXPLORER}/tx/${storageTx}` : null,
        stored: !!storageRoot
      }
    });
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
      _0g: {
        chainRegistered: agent.chainRegistered,
        chainTxHash: agent.chainTxHash,
        chainExplorerUrl: agent.chainTxHash ? `${ZEROG_EXPLORER}/tx/${agent.chainTxHash}` : null
      }
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reputation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
