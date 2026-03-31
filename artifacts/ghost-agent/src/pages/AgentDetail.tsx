import React, { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { 
  useGetAgent, getGetAgentQueryKey,
  useGetAgentActions, getGetAgentActionsQueryKey,
  useGetAgentMemory, getGetAgentMemoryQueryKey,
  useGetAgentReputation, getGetAgentReputationQueryKey,
  useChatWithAgent,
  useUpdateAgent,
  useExecuteAction,
  useAddMemoryEntry
} from "@workspace/api-client-react";
import { Terminal, Shield, Zap, Hash, Database, Clock, Lock, Cpu, Star, ArrowRight, MessageSquare, Play, Pause, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
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
    const newStatus = agent.status === 'paused' ? 'active' : 'paused';
    updateAgentMutation.mutate({ agentId, data: { status: newStatus as any } });
  };

  const [activeTab, setActiveTab] = useState<"terminal" | "actions" | "memory">("terminal");

  if (agentLoading) {
    return <div className="p-8 text-center text-primary animate-pulse font-mono">ESTABLISHING SECURE CONNECTION...</div>;
  }

  if (!agent) {
    return <div className="p-8 text-center text-destructive font-mono">OPERATIVE NOT FOUND</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Profile */}
      <div className="p-6 border border-border/50 bg-card/50 backdrop-blur relative overflow-hidden">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between gap-6 items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold uppercase tracking-widest text-primary glitch-effect" data-text={agent.name}>{agent.name}</h2>
              <div className={`px-2 py-0.5 text-xs border uppercase tracking-widest ${
                agent.status === 'active' ? 'text-green-400 border-green-400/50 bg-green-400/10' :
                agent.status === 'executing' ? 'text-primary border-primary/50 bg-primary/10 animate-pulse' :
                'text-yellow-400 border-yellow-400/50 bg-yellow-400/10'
              }`}>
                {agent.status}
              </div>
              <button 
                onClick={toggleStatus}
                disabled={updateAgentMutation.isPending}
                className="ml-2 p-1.5 border border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                title={agent.status === 'paused' ? 'Resume Operations' : 'Halt Operations'}
              >
                {agent.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
              </button>
            </div>
            
            <p className="text-muted-foreground text-sm font-mono max-w-2xl mb-4">{agent.description || "No specific parameters detailed."}</p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {agent.capabilities.map((cap: string) => (
                <span key={cap} className="text-xs uppercase tracking-wider text-primary border border-primary/30 bg-primary/5 px-2 py-1 flex items-center gap-1">
                  <Cpu size={12} /> {cap}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1">
                <Hash size={14} className="text-secondary" /> ID: {agent.agentId}
              </div>
              <div className="flex items-center gap-1">
                <Lock size={14} className={agent.isPrivate ? "text-green-400" : "text-destructive"} /> 
                {agent.isPrivate ? "PRIVATE ENCLAVE" : "PUBLIC"}
              </div>
            </div>
          </div>

          {/* Reputation Block */}
          <div className="bg-background/80 border border-border/50 p-4 min-w-[250px] z-10">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
              <Star size={14} className="text-primary" /> Reputation Matrix
            </div>
            {repLoading ? (
              <div className="h-16 animate-pulse bg-muted/50"></div>
            ) : reputation ? (
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-bold text-foreground">{reputation.totalScore}</span>
                  <span className="text-xs text-primary uppercase font-bold tracking-widest mb-1 px-1.5 py-0.5 border border-primary/30">
                    Rank: {reputation.rank}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] uppercase text-muted-foreground">
                  <div>Perf: <span className="text-foreground">{reputation.performanceScore}</span></div>
                  <div>Reliability: <span className="text-foreground">{reputation.reliabilityScore}</span></div>
                  <div>Privacy: <span className="text-foreground">{reputation.privacyScore}</span></div>
                  <div>Success: <span className="text-foreground">{reputation.successRate}%</span></div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No data.</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border/50 overflow-x-auto custom-scrollbar">
        <button 
          onClick={() => setActiveTab("terminal")}
          className={`px-4 sm:px-6 py-3 text-xs sm:text-sm uppercase tracking-widest font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === "terminal" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquare size={16} /> Secure Terminal
        </button>
        <button 
          onClick={() => setActiveTab("actions")}
          className={`px-4 sm:px-6 py-3 text-xs sm:text-sm uppercase tracking-widest font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === "actions" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Zap size={16} /> Action Log
        </button>
        <button 
          onClick={() => setActiveTab("memory")}
          className={`px-4 sm:px-6 py-3 text-xs sm:text-sm uppercase tracking-widest font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === "memory" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Database size={16} /> Core Memory
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "terminal" && <TerminalTab agentId={agentId} agentName={agent.name} />}
        {activeTab === "actions" && <ActionsTab agentId={agentId} actions={actions} loading={actionsLoading} />}
        {activeTab === "memory" && <MemoryTab agentId={agentId} memories={memories} loading={memoriesLoading} />}
      </div>
    </div>
  );
}

function ActionsTab({ agentId, actions, loading }: { agentId: number, actions: any, loading: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const executeMutation = useExecuteAction({
    mutation: {
      onSuccess: () => {
        toast({ title: "Action Triggered", description: "Autonomous execution started." });
        queryClient.invalidateQueries({ queryKey: getGetAgentActionsQueryKey(agentId) });
      }
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Execution History</h3>
        <button 
          onClick={() => executeMutation.mutate({ agentId, data: { type: "analysis", title: "Diagnostic Sweep", isPrivate: true } })}
          disabled={executeMutation.isPending}
          className="px-3 py-1.5 bg-primary/10 border border-primary/50 text-primary text-xs uppercase tracking-widest hover:bg-primary/20 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Zap size={12} /> Force Diagnostic
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 border border-border/50"></div>)}
        </div>
      ) : actions?.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 font-mono text-sm">NO ACTIONS RECORDED</div>
      ) : (
        <div className="space-y-3">
          {actions?.map((action: any) => (
            <div key={action.id} className="p-4 border border-border/50 bg-card/30 flex flex-col md:flex-row gap-4 justify-between group hover:border-primary/50 transition-colors">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-foreground">{action.title}</span>
                  <span className="text-[10px] uppercase border px-1 border-primary/30 text-primary">{action.type}</span>
                  <span className={`text-[10px] uppercase border px-1 ${
                    action.status === 'completed' ? 'border-green-400/50 text-green-400 bg-green-400/10' :
                    action.status === 'failed' ? 'border-destructive/50 text-destructive bg-destructive/10' :
                    'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                  }`}>
                    {action.status}
                  </span>
                  {action.isPrivate && <Lock size={12} className="text-secondary" />}
                </div>
                {action.description && <p className="text-xs text-muted-foreground mt-1">{action.description}</p>}
                {action.value && <div className="text-xs text-primary font-mono mt-2">Value: {action.value}</div>}
              </div>
              <div className="flex flex-col items-end justify-between text-right text-[10px] font-mono text-muted-foreground">
                <div>{new Date(action.createdAt).toLocaleString()}</div>
                {action.teeProof && (
                  <div className="text-green-400 flex items-center gap-1 mt-1">
                    <Shield size={10} /> {action.teeProof.substring(0,16)}...
                  </div>
                )}
                {action.txHash && (
                  <div className="text-primary flex items-center gap-1 mt-1">
                    <Hash size={10} /> TX: {action.txHash.substring(0,8)}...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoryTab({ agentId, memories, loading }: { agentId: number, memories: any, loading: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const addMemoryMutation = useAddMemoryEntry({
    mutation: {
      onSuccess: () => {
        toast({ title: "Memory Engram Added", description: "Secure storage updated." });
        setNewKey("");
        setNewValue("");
        queryClient.invalidateQueries({ queryKey: getGetAgentMemoryQueryKey(agentId) });
      }
    }
  });

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newValue) return;
    addMemoryMutation.mutate({
      agentId,
      data: {
        category: "preference",
        key: newKey,
        value: newValue,
        isEncrypted: true
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddMemory} className="p-4 border border-border/50 bg-background/50 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-widest">Engram Key</label>
          <input 
            value={newKey} onChange={e => setNewKey(e.target.value)}
            className="w-full bg-background border border-border p-2 text-sm focus:outline-none focus:border-primary font-mono"
            placeholder="e.g. USER_RISK_TOLERANCE"
          />
        </div>
        <div className="flex-[2] w-full space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-widest">Engram Payload (Encrypted)</label>
          <input 
            value={newValue} onChange={e => setNewValue(e.target.value)}
            className="w-full bg-background border border-border p-2 text-sm focus:outline-none focus:border-primary font-mono"
            placeholder="e.g. HIGH"
          />
        </div>
        <button 
          type="submit"
          disabled={!newKey || !newValue || addMemoryMutation.isPending}
          className="w-full md:w-auto px-4 py-2 bg-secondary/20 hover:bg-secondary border border-secondary text-secondary hover:text-secondary-foreground transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-50 h-[38px] flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Inject
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="animate-pulse col-span-1 md:col-span-2 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-muted/30 border border-border/50"></div>)}
          </div>
        ) : memories?.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border border-dashed border-border/50 font-mono text-sm col-span-1 md:col-span-2">MEMORY BANKS EMPTY</div>
        ) : (
          memories?.map((mem: any) => (
            <div key={mem.id} className="p-4 border border-border/50 bg-card/30 relative overflow-hidden group hover:border-secondary/50 transition-colors">
              {mem.isEncrypted && (
                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none flex justify-end">
                  <div className="w-8 h-8 bg-secondary/20 blur-xl"></div>
                </div>
              )}
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase text-secondary border border-secondary/30 px-1">{mem.category}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{new Date(mem.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="font-mono text-sm font-bold text-foreground mb-1">{mem.key}</div>
              <div className={`font-mono text-xs ${mem.isEncrypted ? 'text-secondary opacity-80 blur-[1px] hover:blur-none transition-all cursor-help' : 'text-primary'}`}>
                {mem.isEncrypted ? '[ENCRYPTED_PAYLOAD_LOCKED]' : mem.value}
              </div>
              <div className="mt-3 flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1">
                  <Star size={10} className={mem.confidence > 80 ? "text-primary" : ""} /> CONF: {mem.confidence}%
                </div>
                {mem.isEncrypted && <Lock size={10} className="text-secondary" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TerminalTab({ agentId, agentName }: { agentId: number, agentName: string }) {
  const [messages, setMessages] = useState<{role: 'user'|'agent', content: string, proof?: string}[]>([
    { role: 'agent', content: `CONNECTION ESTABLISHED. TEE SECURE ENCLAVE ACTIVE. AWAITING INPUT.` }
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const chatMutation = useChatWithAgent({
    mutation: {
      onSuccess: (data) => {
        setMessages(prev => [...prev, { 
          role: 'agent', 
          content: data.reply,
          proof: data.teeProof
        }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { 
          role: 'agent', 
          content: "ERROR: COULD NOT PROCESS DIRECTIVE."
        }]);
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    chatMutation.mutate({ agentId, data: { message: input } });
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  return (
    <div className="flex flex-col h-[500px] border border-border/50 bg-black/60 relative">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[length:100%_4px] pointer-events-none"></div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-sm z-10 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`text-[10px] mb-1 ${msg.role === 'user' ? 'text-muted-foreground' : 'text-primary'} uppercase`}>
              {msg.role === 'user' ? 'COMMANDER' : agentName}
            </div>
            <div className={`max-w-[90%] sm:max-w-[80%] p-3 ${
              msg.role === 'user' 
                ? 'bg-border/30 border border-border text-foreground' 
                : 'bg-primary/10 border border-primary/30 text-primary shadow-[0_0_10px_rgba(0,212,255,0.1)]'
            }`}>
              {msg.content}
            </div>
            {msg.proof && (
              <div className="text-[9px] mt-1 text-green-400/70 flex items-center gap-1 max-w-[90%] sm:max-w-[80%] break-all">
                <Shield size={9} className="flex-shrink-0" /> PROOF: {msg.proof}
              </div>
            )}
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex flex-col items-start">
            <div className="text-[10px] mb-1 text-primary uppercase">{agentName}</div>
            <div className="max-w-[80%] p-3 bg-primary/10 border border-primary/30 text-primary animate-pulse flex gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border/50 p-2 sm:p-3 bg-card/80 z-10 flex gap-2">
        <div className="flex items-center text-primary font-bold px-1 sm:px-2">{">"}</div>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="ENTER DIRECTIVE..."
          className="flex-1 w-full bg-transparent border-none outline-none text-foreground font-mono text-xs sm:text-sm placeholder:text-muted-foreground/50"
          disabled={chatMutation.isPending}
          autoFocus
        />
        <button 
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="text-primary hover:text-primary-foreground hover:bg-primary px-3 sm:px-4 transition-colors uppercase tracking-widest text-xs font-bold disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary"
        >
          Execute
        </button>
      </form>
    </div>
  );
}
