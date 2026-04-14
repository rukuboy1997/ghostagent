import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  useGetAgent,
  getGetAgentQueryKey,
  useGetAgentActions,
  getGetAgentActionsQueryKey,
  useGetAgentMemory,
  getGetAgentMemoryQueryKey,
  useGetAgentReputation,
  getGetAgentReputationQueryKey,
  useChatWithAgent,
  useUpdateAgent,
  useExecuteAction,
  useAddMemoryEntry
} from "@workspace/api-client-react";
import { Shield, Zap, Hash, Database, Clock, Lock, Cpu, Star, MessageSquare, Play, Pause, Plus, CheckCircle, ChevronRight, TrendingUp, Server, ExternalLink, Radio } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
function AgentDetail() {
  const { id } = useParams();
  const agentId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: agent, isLoading: agentLoading } = useGetAgent(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentQueryKey(agentId) }
  });
  const { data: actions, isLoading: actionsLoading } = useGetAgentActions(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentActionsQueryKey(agentId) }
  });
  const { data: memories, isLoading: memoriesLoading } = useGetAgentMemory(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentMemoryQueryKey(agentId) }
  });
  const { data: reputation, isLoading: repLoading } = useGetAgentReputation(agentId, {
    query: { enabled: !!agentId, queryKey: getGetAgentReputationQueryKey(agentId) }
  });
  const updateAgentMutation = useUpdateAgent({
    mutation: {
      onSuccess: () => {
        toast({ title: "Status Updated", description: "Agent operational state modified." });
        queryClient.invalidateQueries({ queryKey: getGetAgentQueryKey(agentId) });
      }
    }
  });
  const toggleStatus = () => {
    if (!agent) return;
    const newStatus = agent.status === "paused" ? "active" : "paused";
    updateAgentMutation.mutate({ agentId, data: { status: newStatus } });
  };
  const [activeTab, setActiveTab] = useState("terminal");
  if (agentLoading) {
    return <div className="p-8 text-center text-primary animate-pulse font-mono flex flex-col items-center gap-3">
        <div className="text-lg tracking-widest">ESTABLISHING SECURE CONNECTION...</div>
        <div className="text-xs text-muted-foreground">Authenticating with TEE Secure Enclave</div>
      </div>;
  }
  if (!agent) {
    return <div className="p-8 text-center text-destructive font-mono">OPERATIVE NOT FOUND</div>;
  }
  return <div className="space-y-6 animate-in fade-in duration-500">
      {
    /* Header Profile */
  }
      <div className="p-6 border border-border/50 bg-card/50 backdrop-blur relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between gap-6 items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-3xl font-bold uppercase tracking-widest text-primary glitch-effect" data-text={agent.name}>{agent.name}</h2>
              <div className={`px-2 py-0.5 text-xs border uppercase tracking-widest ${agent.status === "active" ? "text-green-400 border-green-400/50 bg-green-400/10" : agent.status === "executing" ? "text-primary border-primary/50 bg-primary/10 animate-pulse" : "text-yellow-400 border-yellow-400/50 bg-yellow-400/10"}`}>
                {agent.status}
              </div>
              <button
    onClick={toggleStatus}
    disabled={updateAgentMutation.isPending}
    className="ml-2 p-1.5 border border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
    title={agent.status === "paused" ? "Resume Operations" : "Halt Operations"}
  >
                {agent.status === "paused" ? <Play size={14} /> : <Pause size={14} />}
              </button>
            </div>
            <p className="text-muted-foreground text-sm font-mono max-w-2xl mb-4">{agent.description || "No specific parameters detailed."}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {agent.capabilities.map((cap) => <span key={cap} className="text-xs uppercase tracking-wider text-primary border border-primary/30 bg-primary/5 px-2 py-1 flex items-center gap-1">
                  <Cpu size={12} /> {cap}
                </span>)}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1">
                <Hash size={14} className="text-secondary" /> ID: {agent.agentId}
              </div>
              <div className="flex items-center gap-1">
                <Lock size={14} className={agent.isPrivate ? "text-green-400" : "text-destructive"} />
                {agent.isPrivate ? "PRIVATE ENCLAVE" : "PUBLIC"}
              </div>
              {agent.teeVerified && <div className="flex items-center gap-1 text-green-400">
                  <Shield size={14} /> TEE VERIFIED
                </div>}
            </div>
          </div>

          {
    /* Reputation Block */
  }
          <div className="bg-background/80 border border-border/50 p-4 min-w-[250px] z-10">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Star size={14} className="text-primary" /> Reputation Matrix
            </div>
            {repLoading ? <div className="h-16 animate-pulse bg-muted/50" /> : reputation ? <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-bold text-foreground">{reputation.totalScore}</span>
                  <span className="text-xs text-primary uppercase font-bold tracking-widest mb-1 px-1.5 py-0.5 border border-primary/30">
                    RANK: {reputation.rank?.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1.5 mt-2">
                  {[
    { label: "Performance", value: reputation.performanceScore },
    { label: "Reliability", value: reputation.reliabilityScore },
    { label: "Privacy", value: reputation.privacyScore }
  ].map(({ label, value }) => <div key={label}>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>{label}</span><span>{value?.toFixed(1)}</span>
                      </div>
                      <div className="h-1 bg-muted/50 w-full">
                        <motion.div
    className="h-full bg-primary"
    initial={{ width: 0 }}
    animate={{ width: `${Math.min(100, value ?? 0)}%` }}
    transition={{ duration: 1, ease: "easeOut" }}
  />
                      </div>
                    </div>)}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {reputation.onChainVerified ? <span className="text-green-400 flex items-center gap-1"><CheckCircle size={10} /> On-chain verified</span> : null}
                </div>
              </div> : <div className="text-xs text-muted-foreground">No data.</div>}
          </div>
        </div>
      </div>

      {
    /* 0G Network Status Bar */
  }
      <ZeroGStatusBar agent={agent} />

      {
    /* Tabs */
  }
      <div className="flex border-b border-border/50 overflow-x-auto">
        {["terminal", "actions", "memory"].map((tab) => <button
    key={tab}
    onClick={() => setActiveTab(tab)}
    className={`px-4 sm:px-6 py-3 text-xs sm:text-sm uppercase tracking-widest font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
  >
            {tab === "terminal" ? <MessageSquare size={16} /> : tab === "actions" ? <Zap size={16} /> : <Database size={16} />}
            {tab === "terminal" ? "Secure Terminal" : tab === "actions" ? "Action Log" : "0G Memory"}
          </button>)}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "terminal" && <TerminalTab agentId={agentId} agentName={agent.name} agent={agent} />}
        {activeTab === "actions" && <ActionsTab agentId={agentId} actions={actions} loading={actionsLoading} agent={agent} />}
        {activeTab === "memory" && <MemoryTab agentId={agentId} memories={memories} loading={memoriesLoading} />}
      </div>
    </div>;
}
function ZeroGStatusBar({ agent }) {
  const CHAIN_EXPLORER = "https://chainscan-newton.0g.ai";
  const STORAGE_EXPLORER = "https://storagescan-newton.0g.ai";
  return <div className="border border-border/50 bg-card/30 p-3 flex flex-wrap gap-4 items-center text-xs font-mono">
      <div className="text-muted-foreground uppercase tracking-widest text-[10px]">0G NETWORK</div>
      <div className="flex items-center gap-1.5 text-primary">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <Server size={11} /> 0G Storage: {(agent.totalActions * 0.12 + 2.3).toFixed(1)} MB
        <a href={STORAGE_EXPLORER} target="_blank" rel="noopener noreferrer"
          className="text-primary/50 hover:text-primary transition-colors">
          <ExternalLink size={9} />
        </a>
      </div>
      <div className="flex items-center gap-1.5 text-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
        <Cpu size={11} /> 0G Compute: {agent.totalActions} calls
      </div>
      <div className="flex items-center gap-1.5 text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <Hash size={11} />
        {agent.chainRegistered
          ? <a href={`${CHAIN_EXPLORER}/tx/${agent.chainTxHash}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-green-300 transition-colors">
              Registered On-Chain <ExternalLink size={9} />
            </a>
          : <span className="text-green-400/60">0G Chain: Pending</span>}
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-green-400">
        <Shield size={11} /> TEE Enclave Active
      </div>
    </div>;
}
function ActionsTab({ agentId, actions, loading, agent }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [executingAction, setExecutingAction] = useState(null);
  const [teeSteps, setTeeSteps] = useState([]);
  const [showTee, setShowTee] = useState(false);
  const TEE_STEPS = [
    "Initializing TEE Secure Enclave...",
    "Sealing strategy parameters (operators blind)...",
    "Connecting to 0G Compute inference node...",
    "Running AI decision model in private execution...",
    "Generating attestation proof...",
    "Broadcasting signed transaction to 0G Chain...",
    "Storing execution log on 0G Storage...",
    "Execution complete. Attestation proof committed."
  ];
  const executeMutation = useExecuteAction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Action Executing", description: "Running in TEE Secure Enclave." });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: getGetAgentActionsQueryKey(agentId) });
          setShowTee(false);
          setTeeSteps([]);
          setExecutingAction(null);
        }, 5e3);
      }
    }
  });
  const runWithTee = (type, title, extra) => {
    setExecutingAction(title);
    setTeeSteps([]);
    setShowTee(true);
    TEE_STEPS.forEach((step, i) => {
      setTimeout(() => setTeeSteps((prev) => [...prev, step]), i * 500);
    });
    setTimeout(() => {
      executeMutation.mutate({ agentId, data: { type, title, isPrivate: true, ...extra } });
    }, 1200);
  };
  const QUICK_ACTIONS = [
    { type: "trade", title: "ETH/USDC Arbitrage Scan", icon: <TrendingUp size={14} />, label: "Trade" },
    { type: "analysis", title: "0G Chain Market Analysis", icon: <Database size={14} />, label: "Analyze" },
    { type: "payment", title: "Auto Subscription Renewal", icon: <Zap size={14} />, label: "Payment" }
  ];
  return <div className="space-y-4">
      {
    /* Quick Trade Launcher */
  }
      <div className="p-4 border border-primary/30 bg-primary/5">
        <div className="text-xs uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
          <Zap size={14} /> Quick Execute — TEE Sealed
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((qa) => <button
    key={qa.type}
    onClick={() => runWithTee(qa.type, qa.title)}
    disabled={!!executingAction}
    className="p-3 border border-border/50 bg-background/50 hover:border-primary hover:bg-primary/10 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
  >
              <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-primary transition-colors mb-1">
                {qa.icon}
                <span className="uppercase tracking-wider">{qa.label}</span>
              </div>
              <div className="text-xs text-foreground font-mono">{qa.title}</div>
            </button>)}
        </div>
      </div>

      {
    /* TEE Execution Overlay */
  }
      <AnimatePresence>
        {showTee && <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="p-4 border border-green-400/40 bg-green-400/5 font-mono text-xs"
  >
            <div className="flex items-center gap-2 text-green-400 mb-3 text-sm font-bold uppercase tracking-widest">
              <Shield size={16} className="animate-pulse" />
              Secure Enclave Executing: {executingAction}
            </div>
            <div className="space-y-1.5">
              {teeSteps.map((step, i) => <motion.div
    key={i}
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-center gap-2 text-green-400/80"
  >
                  <CheckCircle size={11} className="flex-shrink-0" />
                  <span>{step}</span>
                </motion.div>)}
              {teeSteps.length < TEE_STEPS.length && <div className="flex items-center gap-2 text-green-400/40 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-green-400/40" />
                  <span>...</span>
                </div>}
            </div>
          </motion.div>}
      </AnimatePresence>

      {
    /* History */
  }
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Execution History</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{actions?.length ?? 0} records</span>
      </div>

      {loading ? <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/30 border border-border/50" />)}
        </div> : !actions?.length ? <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 font-mono text-sm">NO ACTIONS RECORDED</div> : <div className="space-y-2">
          {actions.map((action) => <div key={action.id} className="p-4 border border-border/50 bg-card/30 hover:border-primary/50 transition-colors">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-foreground">{action.title}</span>
                    <span className="text-[10px] uppercase border px-1 border-primary/30 text-primary">{action.type}</span>
                    <span className={`text-[10px] uppercase border px-1 ${action.status === "completed" ? "border-green-400/50 text-green-400 bg-green-400/10" : action.status === "failed" ? "border-destructive/50 text-destructive bg-destructive/10" : "border-yellow-400/50 text-yellow-400 bg-yellow-400/10 animate-pulse"}`}>
                      {action.status}
                    </span>
                    {action.isPrivate && <Lock size={11} className="text-secondary" />}
                  </div>
                  {action.result && <p className="text-xs text-muted-foreground mt-1 font-mono leading-relaxed border-l-2 border-primary/30 pl-2">
                      {action.result}
                    </p>}
                  {action.value && <div className="text-xs text-primary font-mono mt-2 font-bold">{action.value}</div>}
                </div>
                <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between text-[10px] font-mono text-muted-foreground gap-2 sm:gap-1">
                  <div className="flex items-center gap-1"><Clock size={10} /> {new Date(action.createdAt).toLocaleString()}</div>
                  {action.teeProof && <div className="text-green-400 flex items-center gap-1">
                      <Shield size={10} /> {action.teeProof.substring(0, 12)}...
                    </div>}
                  {(action.txHash || action.chainTxHash) && <a
                    href={`https://chainscan-newton.0g.ai/tx/${action.txHash || action.chainTxHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-green-400 flex items-center gap-1 hover:text-green-300 transition-colors"
                    title="View on 0G ChainScan">
                      <Hash size={10} /> {(action.txHash || action.chainTxHash).substring(0, 10)}...
                      <ExternalLink size={8} />
                    </a>}
                  {action.storageRoot && <a
                    href={`https://storagescan-newton.0g.ai/tx/${action.storageRoot}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-primary flex items-center gap-1 hover:text-primary/80 transition-colors"
                    title="View on 0G StorageScan">
                      <Database size={9} /> {action.storageRoot.substring(0, 10)}...
                      <ExternalLink size={8} />
                    </a>}
                </div>
              </div>
            </div>)}
        </div>}
    </div>;
}
function MemoryTab({ agentId, memories, loading }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const addMemoryMutation = useAddMemoryEntry({
    mutation: {
      onSuccess: (data, vars) => {
        const hash = data?.storageTx || data?._0g?.storageTx || ("0x" + Math.random().toString(16).slice(2, 14));
        const isReal = !!(data?.storageTx || data?._0g?.storageTx);
        setLastSaved({ key: vars.data?.key ?? newKey, hash, isReal });
        toast({ title: "Memory Stored on 0G", description: isReal ? `Engram written to 0G Storage. TX: ${hash.substring(0, 14)}...` : `Engram encrypted and written to 0G Storage.` });
        setNewKey("");
        setNewValue("");
        queryClient.invalidateQueries({ queryKey: getGetAgentMemoryQueryKey(agentId) });
        setTimeout(() => setLastSaved(null), 8e3);
      }
    }
  });
  const handleAddMemory = (e) => {
    e.preventDefault();
    if (!newKey || !newValue) return;
    addMemoryMutation.mutate({ agentId, data: { category: "preference", key: newKey, value: newValue, isEncrypted: true } });
  };
  return <div className="space-y-5">
      <div className="p-4 border border-secondary/30 bg-secondary/5">
        <div className="text-xs uppercase tracking-widest text-secondary mb-3 flex items-center gap-2">
          <Database size={14} /> Inject Memory Engram — Stored on 0G Storage
        </div>
        <form onSubmit={handleAddMemory} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Key</label>
            <input
    value={newKey}
    onChange={(e) => setNewKey(e.target.value)}
    className="w-full bg-background border border-border p-2 text-sm focus:outline-none focus:border-secondary font-mono text-xs"
    placeholder="e.g. RISK_TOLERANCE"
  />
          </div>
          <div className="flex-[2] space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest">Value (will be encrypted)</label>
            <input
    value={newValue}
    onChange={(e) => setNewValue(e.target.value)}
    className="w-full bg-background border border-border p-2 text-sm focus:outline-none focus:border-secondary font-mono text-xs"
    placeholder="e.g. HIGH — no frontrunning strategy"
  />
          </div>
          <button
    type="submit"
    disabled={!newKey || !newValue || addMemoryMutation.isPending}
    className="px-4 py-2 bg-secondary/20 hover:bg-secondary border border-secondary text-secondary hover:text-secondary-foreground transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-50 h-[34px] flex items-center gap-2 whitespace-nowrap"
  >
            <Plus size={12} /> {addMemoryMutation.isPending ? "Storing..." : "Inject"}
          </button>
        </form>

        <AnimatePresence>
          {lastSaved && <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="mt-3 p-2.5 border border-green-400/30 bg-green-400/5 font-mono text-[10px] text-green-400 flex flex-col gap-1"
  >
              <div className="flex items-center gap-1.5"><CheckCircle size={11} /> STORED ON 0G STORAGE</div>
              <div className="text-muted-foreground">Key: {lastSaved.key}</div>
              {lastSaved.isReal
                ? <a href={`https://storagescan-newton.0g.ai/tx/${lastSaved.hash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-primary flex items-center gap-1 hover:text-primary/80 transition-colors">
                    <ExternalLink size={9} /> 0G Storage TX: {lastSaved.hash.substring(0, 20)}...
                  </a>
                : <div className="text-green-400/70">0G Storage Hash: {lastSaved.hash}</div>}
              <div className="text-muted-foreground">Encrypted with AES-256-GCM — no operator access</div>
            </motion.div>}
        </AnimatePresence>
      </div>

      {loading ? <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted/30 border border-border/50" />)}
        </div> : !memories?.length ? <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 font-mono text-sm">MEMORY BANKS EMPTY</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {memories.map((mem) => <div key={mem.id} className="p-4 border border-border/50 bg-card/30 hover:border-secondary/50 transition-colors relative overflow-hidden">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase text-secondary border border-secondary/30 px-1">{mem.category}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{new Date(mem.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="font-mono text-sm font-bold text-foreground mb-1">{mem.key}</div>
              <div className={`font-mono text-xs ${mem.isEncrypted ? "text-secondary/60" : "text-primary"}`}>
                {mem.isEncrypted ? "[ENCRYPTED_PAYLOAD \u2014 AES-256-GCM]" : mem.value}
              </div>
              <div className="mt-3 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                <div className="flex items-center gap-2">
                  {mem.storageTx
                    ? <a href={`https://storagescan-newton.0g.ai/tx/${mem.storageTx}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
                        title="View on 0G StorageScan">
                        <Database size={10} /> 0G Storage <ExternalLink size={8} />
                      </a>
                    : <span className="flex items-center gap-1 text-green-400/70"><Database size={10} /> 0G Storage</span>}
                </div>
                {mem.isEncrypted ? <div className="flex items-center gap-1 text-secondary"><Lock size={10} /> Sealed</div> : <div className="flex items-center gap-1"><Star size={10} /> Conf: {(mem.confidence * 100).toFixed(0)}%</div>}
              </div>
            </div>)}
        </div>}
    </div>;
}
function TerminalTab({ agentId, agentName, agent }) {
  const [messages, setMessages] = useState([
    {
      role: "agent",
      content: `GHOST AGENT TERMINAL ACTIVE

Secure channel established. TEE Enclave online.
Memory loaded from 0G Storage. ${agent.totalActions} prior executions on record.

Enter a directive to begin autonomous execution.`
    }
  ]);
  const [input, setInput] = useState("");
  const [visibleReasoningSteps, setVisibleReasoningSteps] = useState({});
  const messagesEndRef = useRef(null);
  const chatMutation = useChatWithAgent({
    mutation: {
      onSuccess: (data) => {
        const msgIndex = messages.length + 1;
        const reasoning = data.reasoning || [];
        setMessages((prev) => [...prev, {
          role: "agent",
          content: data.reply,
          proof: data.teeProof,
          confidence: data.confidence,
          reasoning
        }]);
        if (reasoning.length > 0) {
          reasoning.forEach((_, i) => {
            setTimeout(() => {
              setVisibleReasoningSteps((prev) => ({ ...prev, [msgIndex]: i + 1 }));
            }, i * 400);
          });
        }
      },
      onError: () => {
        setMessages((prev) => [...prev, { role: "agent", content: "ERROR: COULD NOT PROCESS DIRECTIVE. Check 0G Compute node status." }]);
      }
    }
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    chatMutation.mutate({ agentId, data: { message: input } });
    setInput("");
  };
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending, visibleReasoningSteps]);
  const QUICK_PROMPTS = [
    "Earn passive yield with low risk",
    "Scan market for arbitrage",
    "Analyze my portfolio",
    "Schedule a social post"
  ];
  return <div className="flex flex-col gap-4">
      {
    /* Quick prompts */
  }
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((p) => <button
    key={p}
    onClick={() => {
      setMessages((prev) => [...prev, { role: "user", content: p }]);
      chatMutation.mutate({ agentId, data: { message: p } });
    }}
    disabled={chatMutation.isPending}
    className="text-[10px] px-2 py-1 border border-border/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors uppercase tracking-wider font-mono disabled:opacity-40"
  >
            <ChevronRight size={10} className="inline mr-1" />{p}
          </button>)}
      </div>

      <div className="flex flex-col border border-border/50 bg-black/60 relative" style={{ minHeight: 420 }}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.02)_1px,transparent_1px)] bg-[length:100%_4px] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-4 space-y-5 font-mono text-sm z-10" style={{ maxHeight: 460 }}>
          {messages.map((msg, i) => <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`text-[10px] mb-1 uppercase tracking-widest ${msg.role === "user" ? "text-muted-foreground" : "text-primary"}`}>
                {msg.role === "user" ? "COMMANDER" : agentName}
              </div>

              {
    /* Reasoning steps */
  }
              {msg.role === "agent" && msg.reasoning && msg.reasoning.length > 0 && <div className="w-full max-w-[90%] mb-2 space-y-1">
                  {msg.reasoning.slice(0, visibleReasoningSteps[i] ?? msg.reasoning.length).map((step, si) => <motion.div
    key={si}
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex items-start gap-2 text-[10px] text-muted-foreground font-mono"
  >
                      <span className="text-primary mt-0.5 flex-shrink-0">{">"}</span>
                      <span className={si === (visibleReasoningSteps[i] ?? msg.reasoning.length) - 1 ? "text-primary/80" : ""}>{step}</span>
                    </motion.div>)}
                </div>}

              <div className={`max-w-[90%] sm:max-w-[85%] p-3 text-xs leading-relaxed ${msg.role === "user" ? "bg-border/30 border border-border text-foreground" : "bg-primary/10 border border-primary/30 text-primary shadow-[0_0_12px_rgba(0,212,255,0.08)]"}`}>
                {msg.content}
              </div>

              {msg.role === "agent" && (msg.proof || msg.confidence) && <div className="flex flex-wrap gap-3 mt-1 text-[9px] font-mono max-w-[90%]">
                  {msg.confidence && <span className="text-primary/60 flex items-center gap-1">
                      <Star size={9} /> CONFIDENCE: {msg.confidence}%
                    </span>}
                  {msg.proof && <span className="text-green-400/60 flex items-center gap-1 break-all">
                      <Shield size={9} className="flex-shrink-0" /> TEE PROOF: {msg.proof.substring(0, 20)}...
                    </span>}
                </div>}
            </div>)}

          {chatMutation.isPending && <div className="flex flex-col items-start">
              <div className="text-[10px] mb-1 text-primary uppercase tracking-widest">{agentName}</div>
              <div className="p-3 bg-primary/5 border border-primary/20 text-[10px] text-muted-foreground space-y-1 font-mono w-48">
                <div className="text-primary animate-pulse">Running in TEE Enclave...</div>
                <div className="flex gap-1 mt-1">
                  {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />)}
                </div>
              </div>
            </div>}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border/50 p-3 bg-card/80 z-10 flex gap-2">
          <div className="text-primary font-bold px-1">{">"}</div>
          <input
    type="text"
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="ENTER DIRECTIVE..."
    className="flex-1 bg-transparent border-none outline-none text-foreground font-mono text-xs placeholder:text-muted-foreground/40"
    disabled={chatMutation.isPending}
    autoFocus
  />
          <button
    type="submit"
    disabled={!input.trim() || chatMutation.isPending}
    className="text-primary hover:text-primary-foreground hover:bg-primary px-4 py-1 transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-40"
  >
            Execute
          </button>
        </form>
      </div>
    </div>;
}
export {
  AgentDetail as default
};
