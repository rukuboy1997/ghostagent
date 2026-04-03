const AgentPersonality = {
  aggressive: "aggressive",
  balanced: "balanced",
  conservative: "conservative"
};
const AgentStatus = {
  active: "active",
  idle: "idle",
  executing: "executing",
  paused: "paused"
};
const CreateAgentInputPersonality = {
  aggressive: "aggressive",
  balanced: "balanced",
  conservative: "conservative"
};
const UpdateAgentInputPersonality = {
  aggressive: "aggressive",
  balanced: "balanced",
  conservative: "conservative"
};
const UpdateAgentInputStatus = {
  active: "active",
  idle: "idle",
  executing: "executing",
  paused: "paused"
};
const AgentActionType = {
  trade: "trade",
  social_post: "social_post",
  payment: "payment",
  negotiation: "negotiation",
  analysis: "analysis"
};
const AgentActionStatus = {
  pending: "pending",
  executing: "executing",
  completed: "completed",
  failed: "failed"
};
const ExecuteActionInputType = {
  trade: "trade",
  social_post: "social_post",
  payment: "payment",
  negotiation: "negotiation",
  analysis: "analysis"
};
const MemoryEntryCategory = {
  preference: "preference",
  financial_history: "financial_history",
  behavior_pattern: "behavior_pattern",
  strategy: "strategy",
  social: "social"
};
const CreateMemoryInputCategory = {
  preference: "preference",
  financial_history: "financial_history",
  behavior_pattern: "behavior_pattern",
  strategy: "strategy",
  social: "social"
};
const ReputationScoreRank = {
  ghost: "ghost",
  shadow: "shadow",
  specter: "specter",
  phantom: "phantom",
  wraith: "wraith"
};
const MarketplaceListingCategory = {
  trading: "trading",
  social: "social",
  payments: "payments",
  all_in_one: "all_in_one"
};
const ActivityFeedItemType = {
  trade: "trade",
  social_post: "social_post",
  payment: "payment",
  negotiation: "negotiation",
  analysis: "analysis",
  created: "created"
};
export {
  ActivityFeedItemType,
  AgentActionStatus,
  AgentActionType,
  AgentPersonality,
  AgentStatus,
  CreateAgentInputPersonality,
  CreateMemoryInputCategory,
  ExecuteActionInputType,
  MarketplaceListingCategory,
  MemoryEntryCategory,
  ReputationScoreRank,
  UpdateAgentInputPersonality,
  UpdateAgentInputStatus
};
