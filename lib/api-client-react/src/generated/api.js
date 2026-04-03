import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "../custom-fetch";
const getHealthCheckUrl = () => {
  return `/api/healthz`;
};
const healthCheck = async (options) => {
  return customFetch(getHealthCheckUrl(), {
    ...options,
    method: "GET"
  });
};
const getHealthCheckQueryKey = () => {
  return [`/api/healthz`];
};
const getHealthCheckQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getHealthCheckQueryKey();
  const queryFn = ({
    signal
  }) => healthCheck({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useHealthCheck(options) {
  const queryOptions = getHealthCheckQueryOptions(options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getGetAgentsUrl = () => {
  return `/api/agents`;
};
const getAgents = async (options) => {
  return customFetch(getGetAgentsUrl(), {
    ...options,
    method: "GET"
  });
};
const getGetAgentsQueryKey = () => {
  return [`/api/agents`];
};
const getGetAgentsQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAgentsQueryKey();
  const queryFn = ({
    signal
  }) => getAgents({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetAgents(options) {
  const queryOptions = getGetAgentsQueryOptions(options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getCreateAgentUrl = () => {
  return `/api/agents`;
};
const createAgent = async (createAgentInput, options) => {
  return customFetch(getCreateAgentUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(createAgentInput)
  });
};
const getCreateAgentMutationOptions = (options) => {
  const mutationKey = ["createAgent"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { data } = props ?? {};
    return createAgent(data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useCreateAgent = (options) => {
  return useMutation(getCreateAgentMutationOptions(options));
};
const getGetAgentUrl = (agentId) => {
  return `/api/agents/${agentId}`;
};
const getAgent = async (agentId, options) => {
  return customFetch(getGetAgentUrl(agentId), {
    ...options,
    method: "GET"
  });
};
const getGetAgentQueryKey = (agentId) => {
  return [`/api/agents/${agentId}`];
};
const getGetAgentQueryOptions = (agentId, options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAgentQueryKey(agentId);
  const queryFn = ({
    signal
  }) => getAgent(agentId, { signal, ...requestOptions });
  return {
    queryKey,
    queryFn,
    enabled: !!agentId,
    ...queryOptions
  };
};
function useGetAgent(agentId, options) {
  const queryOptions = getGetAgentQueryOptions(agentId, options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getUpdateAgentUrl = (agentId) => {
  return `/api/agents/${agentId}`;
};
const updateAgent = async (agentId, updateAgentInput, options) => {
  return customFetch(getUpdateAgentUrl(agentId), {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(updateAgentInput)
  });
};
const getUpdateAgentMutationOptions = (options) => {
  const mutationKey = ["updateAgent"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { agentId, data } = props ?? {};
    return updateAgent(agentId, data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useUpdateAgent = (options) => {
  return useMutation(getUpdateAgentMutationOptions(options));
};
const getDeleteAgentUrl = (agentId) => {
  return `/api/agents/${agentId}`;
};
const deleteAgent = async (agentId, options) => {
  return customFetch(getDeleteAgentUrl(agentId), {
    ...options,
    method: "DELETE"
  });
};
const getDeleteAgentMutationOptions = (options) => {
  const mutationKey = ["deleteAgent"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { agentId } = props ?? {};
    return deleteAgent(agentId, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useDeleteAgent = (options) => {
  return useMutation(getDeleteAgentMutationOptions(options));
};
const getChatWithAgentUrl = (agentId) => {
  return `/api/agents/${agentId}/chat`;
};
const chatWithAgent = async (agentId, chatInput, options) => {
  return customFetch(getChatWithAgentUrl(agentId), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(chatInput)
  });
};
const getChatWithAgentMutationOptions = (options) => {
  const mutationKey = ["chatWithAgent"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { agentId, data } = props ?? {};
    return chatWithAgent(agentId, data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useChatWithAgent = (options) => {
  return useMutation(getChatWithAgentMutationOptions(options));
};
const getGetAgentActionsUrl = (agentId) => {
  return `/api/agents/${agentId}/actions`;
};
const getAgentActions = async (agentId, options) => {
  return customFetch(getGetAgentActionsUrl(agentId), {
    ...options,
    method: "GET"
  });
};
const getGetAgentActionsQueryKey = (agentId) => {
  return [`/api/agents/${agentId}/actions`];
};
const getGetAgentActionsQueryOptions = (agentId, options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAgentActionsQueryKey(agentId);
  const queryFn = ({
    signal
  }) => getAgentActions(agentId, { signal, ...requestOptions });
  return {
    queryKey,
    queryFn,
    enabled: !!agentId,
    ...queryOptions
  };
};
function useGetAgentActions(agentId, options) {
  const queryOptions = getGetAgentActionsQueryOptions(agentId, options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getExecuteActionUrl = (agentId) => {
  return `/api/agents/${agentId}/actions`;
};
const executeAction = async (agentId, executeActionInput, options) => {
  return customFetch(getExecuteActionUrl(agentId), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(executeActionInput)
  });
};
const getExecuteActionMutationOptions = (options) => {
  const mutationKey = ["executeAction"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { agentId, data } = props ?? {};
    return executeAction(agentId, data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useExecuteAction = (options) => {
  return useMutation(getExecuteActionMutationOptions(options));
};
const getGetAgentMemoryUrl = (agentId) => {
  return `/api/agents/${agentId}/memory`;
};
const getAgentMemory = async (agentId, options) => {
  return customFetch(getGetAgentMemoryUrl(agentId), {
    ...options,
    method: "GET"
  });
};
const getGetAgentMemoryQueryKey = (agentId) => {
  return [`/api/agents/${agentId}/memory`];
};
const getGetAgentMemoryQueryOptions = (agentId, options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAgentMemoryQueryKey(agentId);
  const queryFn = ({
    signal
  }) => getAgentMemory(agentId, { signal, ...requestOptions });
  return {
    queryKey,
    queryFn,
    enabled: !!agentId,
    ...queryOptions
  };
};
function useGetAgentMemory(agentId, options) {
  const queryOptions = getGetAgentMemoryQueryOptions(agentId, options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getAddMemoryEntryUrl = (agentId) => {
  return `/api/agents/${agentId}/memory`;
};
const addMemoryEntry = async (agentId, createMemoryInput, options) => {
  return customFetch(getAddMemoryEntryUrl(agentId), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(createMemoryInput)
  });
};
const getAddMemoryEntryMutationOptions = (options) => {
  const mutationKey = ["addMemoryEntry"];
  const { mutation: mutationOptions, request: requestOptions } = options ? options.mutation && "mutationKey" in options.mutation && options.mutation.mutationKey ? options : { ...options, mutation: { ...options.mutation, mutationKey } } : { mutation: { mutationKey }, request: void 0 };
  const mutationFn = (props) => {
    const { agentId, data } = props ?? {};
    return addMemoryEntry(agentId, data, requestOptions);
  };
  return { mutationFn, ...mutationOptions };
};
const useAddMemoryEntry = (options) => {
  return useMutation(getAddMemoryEntryMutationOptions(options));
};
const getGetAgentReputationUrl = (agentId) => {
  return `/api/agents/${agentId}/reputation`;
};
const getAgentReputation = async (agentId, options) => {
  return customFetch(getGetAgentReputationUrl(agentId), {
    ...options,
    method: "GET"
  });
};
const getGetAgentReputationQueryKey = (agentId) => {
  return [`/api/agents/${agentId}/reputation`];
};
const getGetAgentReputationQueryOptions = (agentId, options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetAgentReputationQueryKey(agentId);
  const queryFn = ({ signal }) => getAgentReputation(agentId, { signal, ...requestOptions });
  return {
    queryKey,
    queryFn,
    enabled: !!agentId,
    ...queryOptions
  };
};
function useGetAgentReputation(agentId, options) {
  const queryOptions = getGetAgentReputationQueryOptions(agentId, options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getGetMarketplaceUrl = () => {
  return `/api/marketplace`;
};
const getMarketplace = async (options) => {
  return customFetch(getGetMarketplaceUrl(), {
    ...options,
    method: "GET"
  });
};
const getGetMarketplaceQueryKey = () => {
  return [`/api/marketplace`];
};
const getGetMarketplaceQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetMarketplaceQueryKey();
  const queryFn = ({
    signal
  }) => getMarketplace({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetMarketplace(options) {
  const queryOptions = getGetMarketplaceQueryOptions(options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getGetPlatformStatsUrl = () => {
  return `/api/stats/platform`;
};
const getPlatformStats = async (options) => {
  return customFetch(getGetPlatformStatsUrl(), {
    ...options,
    method: "GET"
  });
};
const getGetPlatformStatsQueryKey = () => {
  return [`/api/stats/platform`];
};
const getGetPlatformStatsQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetPlatformStatsQueryKey();
  const queryFn = ({ signal }) => getPlatformStats({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetPlatformStats(options) {
  const queryOptions = getGetPlatformStatsQueryOptions(options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
const getGetRecentActivityUrl = () => {
  return `/api/stats/activity`;
};
const getRecentActivity = async (options) => {
  return customFetch(getGetRecentActivityUrl(), {
    ...options,
    method: "GET"
  });
};
const getGetRecentActivityQueryKey = () => {
  return [`/api/stats/activity`];
};
const getGetRecentActivityQueryOptions = (options) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetRecentActivityQueryKey();
  const queryFn = ({ signal }) => getRecentActivity({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions };
};
function useGetRecentActivity(options) {
  const queryOptions = getGetRecentActivityQueryOptions(options);
  const query = useQuery(queryOptions);
  return { ...query, queryKey: queryOptions.queryKey };
}
export {
  addMemoryEntry,
  chatWithAgent,
  createAgent,
  deleteAgent,
  executeAction,
  getAddMemoryEntryMutationOptions,
  getAddMemoryEntryUrl,
  getAgent,
  getAgentActions,
  getAgentMemory,
  getAgentReputation,
  getAgents,
  getChatWithAgentMutationOptions,
  getChatWithAgentUrl,
  getCreateAgentMutationOptions,
  getCreateAgentUrl,
  getDeleteAgentMutationOptions,
  getDeleteAgentUrl,
  getExecuteActionMutationOptions,
  getExecuteActionUrl,
  getGetAgentActionsQueryKey,
  getGetAgentActionsQueryOptions,
  getGetAgentActionsUrl,
  getGetAgentMemoryQueryKey,
  getGetAgentMemoryQueryOptions,
  getGetAgentMemoryUrl,
  getGetAgentQueryKey,
  getGetAgentQueryOptions,
  getGetAgentReputationQueryKey,
  getGetAgentReputationQueryOptions,
  getGetAgentReputationUrl,
  getGetAgentUrl,
  getGetAgentsQueryKey,
  getGetAgentsQueryOptions,
  getGetAgentsUrl,
  getGetMarketplaceQueryKey,
  getGetMarketplaceQueryOptions,
  getGetMarketplaceUrl,
  getGetPlatformStatsQueryKey,
  getGetPlatformStatsQueryOptions,
  getGetPlatformStatsUrl,
  getGetRecentActivityQueryKey,
  getGetRecentActivityQueryOptions,
  getGetRecentActivityUrl,
  getHealthCheckQueryKey,
  getHealthCheckQueryOptions,
  getHealthCheckUrl,
  getMarketplace,
  getPlatformStats,
  getRecentActivity,
  getUpdateAgentMutationOptions,
  getUpdateAgentUrl,
  healthCheck,
  updateAgent,
  useAddMemoryEntry,
  useChatWithAgent,
  useCreateAgent,
  useDeleteAgent,
  useExecuteAction,
  useGetAgent,
  useGetAgentActions,
  useGetAgentMemory,
  useGetAgentReputation,
  useGetAgents,
  useGetMarketplace,
  useGetPlatformStats,
  useGetRecentActivity,
  useHealthCheck,
  useUpdateAgent
};
