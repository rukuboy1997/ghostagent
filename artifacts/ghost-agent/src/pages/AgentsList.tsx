import React from "react";
import { Link } from "wouter";
import { 
  useGetAgents, 
  getGetAgentsQueryKey,
  useDeleteAgent
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, Zap, Terminal, Plus, Trash2, Cpu, Hash } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AgentsList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: agents, isLoading } = useGetAgents({
    query: { queryKey: getGetAgentsQueryKey() }
  });

  const deleteAgentMutation = useDeleteAgent({
    mutation: {
      onSuccess: () => {
        toast({
          title: "Operative Terminated",
          description: "The agent has been securely wiped from the platform.",
        });
        queryClient.invalidateQueries({ queryKey: getGetAgentsQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Termination Failed",
          description: "Could not delete operative.",
          variant: "destructive",
        });
      }
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Cpu size={24} /> Operatives Protocol
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Manage Autonomous Entities</p>
        </div>
        <Link href="/agents/new">
          <div className="flex items-center gap-2 text-sm px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors uppercase tracking-widest font-bold cursor-pointer clip-path-slant shadow-[0_0_15px_rgba(0,212,255,0.3)]">
            <Plus size={16} /> Deploy New Operative
          </div>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i} className="border-border/50 bg-card/50 h-48 animate-pulse"></Card>
          ))}
        </div>
      ) : agents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-border/50 bg-background/30 text-center">
          <Terminal size={48} className="text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-foreground mb-2">No Active Operatives</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">Deploy your first GhostAgent to execute on-chain actions, social strategies, or autonomous trading in a secure TEE environment.</p>
          <Link href="/agents/new">
            <div className="flex items-center gap-2 text-sm px-6 py-2 border border-primary text-primary hover:bg-primary/10 transition-colors uppercase tracking-widest cursor-pointer">
              Initialize Protocol
            </div>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents?.map((agent) => (
            <AgentCard 
              key={agent.id} 
              agent={agent} 
              onDelete={() => {
                if (confirm(`Are you sure you want to terminate ${agent.name}? This action cannot be undone.`)) {
                  deleteAgentMutation.mutate({ agentId: agent.id });
                }
              }} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onDelete }: { agent: any, onDelete: () => void }) {
  return (
    <div className="group relative border border-border/50 bg-card/50 backdrop-blur flex flex-col h-full overflow-hidden hover:border-primary/50 transition-colors">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
      
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <Link href={`/agents/${agent.id}`}>
            <div className="cursor-pointer">
              <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                {agent.name}
              </h3>
              <div className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-1">
                <Hash size={12} /> {agent.agentId.substring(0, 10)}...{agent.agentId.substring(agent.agentId.length - 4)}
              </div>
            </div>
          </Link>
          <div className={`text-[10px] uppercase tracking-widest px-2 py-1 border ${
            agent.status === 'active' ? 'text-green-400 border-green-400/50 bg-green-400/10' :
            agent.status === 'executing' ? 'text-primary border-primary/50 bg-primary/10 animate-pulse' :
            agent.status === 'paused' ? 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' :
            'text-muted-foreground border-border bg-muted/20'
          }`}>
            {agent.status}
          </div>
        </div>

        <p className="text-sm text-foreground/70 line-clamp-2">
          {agent.description || "No operational parameters described."}
        </p>

        <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border/30">
          <div className="text-xs px-2 py-1 bg-background border border-border/50 text-muted-foreground flex items-center gap-1">
            <Zap size={12} className="text-secondary" /> {agent.totalActions} Actions
          </div>
          <div className="text-xs px-2 py-1 bg-background border border-border/50 text-muted-foreground flex items-center gap-1">
            SR: {agent.successRate}%
          </div>
          {agent.teeVerified && (
            <div className="text-xs px-2 py-1 bg-green-400/10 border border-green-400/30 text-green-400 flex items-center gap-1 ml-auto">
              <Shield size={12} /> TEE
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/50 bg-background/50 p-2 flex justify-between items-center px-4">
        <div className="flex gap-2">
          {agent.capabilities.slice(0, 3).map((cap: string) => (
            <span key={cap} className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1 py-0.5">
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 py-0.5">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agents/${agent.id}`}>
            <button className="text-xs uppercase tracking-widest text-primary hover:text-primary/80 transition-colors p-2">
              Terminal
            </button>
          </Link>
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="text-muted-foreground hover:text-destructive transition-colors p-2"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
