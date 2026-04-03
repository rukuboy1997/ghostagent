import * as zod from "zod";
const HealthCheckResponse = zod.object({
  status: zod.string()
});
const GetAgentsResponseItem = zod.object({
  id: zod.number(),
  name: zod.string(),
  description: zod.string().optional(),
  personality: zod.enum(["aggressive", "balanced", "conservative"]),
  status: zod.enum(["active", "idle", "executing", "paused"]),
  agentId: zod.string().describe("On-chain identity hash"),
  reputationScore: zod.number(),
  totalActions: zod.number(),
  successRate: zod.number(),
  capabilities: zod.array(zod.string()).describe("trading, social, payments, negotiations"),
  isPrivate: zod.boolean(),
  teeVerified: zod.boolean(),
  createdAt: zod.coerce.date(),
  updatedAt: zod.coerce.date()
});
const GetAgentsResponse = zod.array(GetAgentsResponseItem);
const CreateAgentBody = zod.object({
  name: zod.string(),
  description: zod.string().optional(),
  personality: zod.enum(["aggressive", "balanced", "conservative"]),
  capabilities: zod.array(zod.string()),
  isPrivate: zod.boolean().optional()
});
const GetAgentParams = zod.object({
  agentId: zod.coerce.number()
});
const GetAgentResponse = zod.object({
  id: zod.number(),
  name: zod.string(),
  description: zod.string().optional(),
  personality: zod.enum(["aggressive", "balanced", "conservative"]),
  status: zod.enum(["active", "idle", "executing", "paused"]),
  agentId: zod.string().describe("On-chain identity hash"),
  reputationScore: zod.number(),
  totalActions: zod.number(),
  successRate: zod.number(),
  capabilities: zod.array(zod.string()).describe("trading, social, payments, negotiations"),
  isPrivate: zod.boolean(),
  teeVerified: zod.boolean(),
  createdAt: zod.coerce.date(),
  updatedAt: zod.coerce.date()
});
const UpdateAgentParams = zod.object({
  agentId: zod.coerce.number()
});
const UpdateAgentBody = zod.object({
  name: zod.string().optional(),
  description: zod.string().optional(),
  personality: zod.enum(["aggressive", "balanced", "conservative"]).optional(),
  status: zod.enum(["active", "idle", "executing", "paused"]).optional(),
  capabilities: zod.array(zod.string()).optional(),
  isPrivate: zod.boolean().optional()
});
const UpdateAgentResponse = zod.object({
  id: zod.number(),
  name: zod.string(),
  description: zod.string().optional(),
  personality: zod.enum(["aggressive", "balanced", "conservative"]),
  status: zod.enum(["active", "idle", "executing", "paused"]),
  agentId: zod.string().describe("On-chain identity hash"),
  reputationScore: zod.number(),
  totalActions: zod.number(),
  successRate: zod.number(),
  capabilities: zod.array(zod.string()).describe("trading, social, payments, negotiations"),
  isPrivate: zod.boolean(),
  teeVerified: zod.boolean(),
  createdAt: zod.coerce.date(),
  updatedAt: zod.coerce.date()
});
const DeleteAgentParams = zod.object({
  agentId: zod.coerce.number()
});
const ChatWithAgentParams = zod.object({
  agentId: zod.coerce.number()
});
const ChatWithAgentBody = zod.object({
  message: zod.string(),
  context: zod.string().optional()
});
const ChatWithAgentResponse = zod.object({
  reply: zod.string(),
  actionSuggested: zod.string().optional(),
  confidence: zod.number(),
  teeProof: zod.string()
});
const GetAgentActionsParams = zod.object({
  agentId: zod.coerce.number()
});
const GetAgentActionsResponseItem = zod.object({
  id: zod.number(),
  agentId: zod.number(),
  type: zod.enum([
    "trade",
    "social_post",
    "payment",
    "negotiation",
    "analysis"
  ]),
  title: zod.string(),
  description: zod.string().optional(),
  status: zod.enum(["pending", "executing", "completed", "failed"]),
  result: zod.string().optional(),
  txHash: zod.string().optional(),
  gasUsed: zod.string().optional(),
  teeProof: zod.string().optional(),
  isPrivate: zod.boolean(),
  value: zod.string().optional(),
  createdAt: zod.coerce.date(),
  completedAt: zod.coerce.date().optional()
});
const GetAgentActionsResponse = zod.array(GetAgentActionsResponseItem);
const ExecuteActionParams = zod.object({
  agentId: zod.coerce.number()
});
const ExecuteActionBody = zod.object({
  type: zod.enum([
    "trade",
    "social_post",
    "payment",
    "negotiation",
    "analysis"
  ]),
  title: zod.string(),
  description: zod.string().optional(),
  isPrivate: zod.boolean().optional(),
  params: zod.record(zod.string(), zod.unknown()).optional()
});
const GetAgentMemoryParams = zod.object({
  agentId: zod.coerce.number()
});
const GetAgentMemoryResponseItem = zod.object({
  id: zod.number(),
  agentId: zod.number(),
  category: zod.enum([
    "preference",
    "financial_history",
    "behavior_pattern",
    "strategy",
    "social"
  ]),
  key: zod.string(),
  value: zod.string(),
  confidence: zod.number(),
  isEncrypted: zod.boolean(),
  createdAt: zod.coerce.date()
});
const GetAgentMemoryResponse = zod.array(GetAgentMemoryResponseItem);
const AddMemoryEntryParams = zod.object({
  agentId: zod.coerce.number()
});
const AddMemoryEntryBody = zod.object({
  category: zod.enum([
    "preference",
    "financial_history",
    "behavior_pattern",
    "strategy",
    "social"
  ]),
  key: zod.string(),
  value: zod.string(),
  isEncrypted: zod.boolean().optional()
});
const GetAgentReputationParams = zod.object({
  agentId: zod.coerce.number()
});
const GetAgentReputationResponse = zod.object({
  agentId: zod.number(),
  totalScore: zod.number(),
  performanceScore: zod.number(),
  reliabilityScore: zod.number(),
  privacyScore: zod.number(),
  actionsCompleted: zod.number(),
  successRate: zod.number(),
  rank: zod.enum(["ghost", "shadow", "specter", "phantom", "wraith"]),
  onChainVerified: zod.boolean()
});
const GetMarketplaceResponseItem = zod.object({
  id: zod.number(),
  agentId: zod.number(),
  agentName: zod.string(),
  description: zod.string().optional(),
  strategy: zod.string(),
  price: zod.string(),
  reputationScore: zod.number(),
  successRate: zod.number(),
  category: zod.enum(["trading", "social", "payments", "all_in_one"]),
  isVerified: zod.boolean(),
  rentals: zod.number()
});
const GetMarketplaceResponse = zod.array(GetMarketplaceResponseItem);
const GetPlatformStatsResponse = zod.object({
  totalAgents: zod.number(),
  activeAgents: zod.number(),
  totalActions: zod.number(),
  totalValueManaged: zod.string(),
  teeExecutions: zod.number(),
  successRate: zod.number(),
  storageUsed: zod.string(),
  onChainTxns: zod.number()
});
const GetRecentActivityResponseItem = zod.object({
  id: zod.number(),
  agentName: zod.string(),
  action: zod.string(),
  type: zod.enum([
    "trade",
    "social_post",
    "payment",
    "negotiation",
    "analysis",
    "created"
  ]),
  value: zod.string().optional(),
  isPrivate: zod.boolean(),
  teeVerified: zod.boolean(),
  timestamp: zod.coerce.date()
});
const GetRecentActivityResponse = zod.array(
  GetRecentActivityResponseItem
);
export {
  AddMemoryEntryBody,
  AddMemoryEntryParams,
  ChatWithAgentBody,
  ChatWithAgentParams,
  ChatWithAgentResponse,
  CreateAgentBody,
  DeleteAgentParams,
  ExecuteActionBody,
  ExecuteActionParams,
  GetAgentActionsParams,
  GetAgentActionsResponse,
  GetAgentActionsResponseItem,
  GetAgentMemoryParams,
  GetAgentMemoryResponse,
  GetAgentMemoryResponseItem,
  GetAgentParams,
  GetAgentReputationParams,
  GetAgentReputationResponse,
  GetAgentResponse,
  GetAgentsResponse,
  GetAgentsResponseItem,
  GetMarketplaceResponse,
  GetMarketplaceResponseItem,
  GetPlatformStatsResponse,
  GetRecentActivityResponse,
  GetRecentActivityResponseItem,
  HealthCheckResponse,
  UpdateAgentBody,
  UpdateAgentParams,
  UpdateAgentResponse
};
