import React from "react";
import { 
  useGetPlatformStats, getGetPlatformStatsQueryKey,
  useGetRecentActivity, getGetRecentActivityQueryKey,
  useGetAgents, getGetAgentsQueryKey
} from "@workspace/api-client-react";
import { Activity, Shield, Zap, Hash, Database, Clock, Terminal, Server, Cpu, Lock, CheckCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPlatformStats({
    query: { queryKey: getGetPlatformStatsQueryKey() }
  });
  const { data: activities, isLoading: activitiesLoading } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey() }
  });
  const { data: agents, isLoading: agentsLoading } = useGetAgents({
    query: { queryKey: getGetAgentsQueryKey() }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Terminal size={24} /> Global Command
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Platform Telemetry & Operations</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">System Status</div>
          <div className="text-green-400 text-sm font-bold flex items-center gap-2 justify-end">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            NOMINAL
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Operatives" value={stats?.activeAgents ?? "--"} subValue={`/ ${stats?.totalAgents ?? "--"} Total`} icon={<Zap size={18} className="text-primary" />} loading={statsLoading} />
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <StatCard title="Value Managed" value={stats?.totalValueManaged ?? "--"} icon={<TrendingUp size={18} className="text-secondary" />} loading={statsLoading} className="border-primary/50 bg-primary/5 relative z-10" />
        </div>
        <StatCard title="TEE Executions" value={stats?.teeExecutions ?? "--"} subValue={`${stats?.successRate ? (stats.successRate * 100).toFixed(1) : "--"}% Success`} icon={<Shield size={18} className="text-green-400" />} loading={statsLoading} />
        <StatCard title="On-Chain Txns" value={stats?.onChainTxns ?? "--"} icon={<Hash size={18} className="text-primary" />} loading={statsLoading} />
      </div>

      {/* 0G Network Status */}
      <ZeroGNetworkPanel stats={stats} loading={statsLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Feed */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Activity size={16} /> Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2">
              {activitiesLoading ? (
                <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted/50 animate-pulse border border-border/50" />)}</div>
              ) : !activities?.length ? (
                <div className="text-center p-8 text-muted-foreground font-mono text-sm">NO ACTIVITY DETECTED</div>
              ) : (
                activities.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-3 border border-border/30 bg-background/50 hover:border-primary/50 transition-colors group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/50 transform origin-top scale-y-0 group-hover:scale-y-100 transition-transform" />
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="font-bold text-primary text-xs">{item.agentName}</span>
                          <span className="text-[10px] uppercase px-1 border border-border text-muted-foreground">{item.type}</span>
                          {item.isPrivate && (
                            <span className="text-[10px] text-secondary flex items-center gap-0.5">
                              <Lock size={9} /> SEALED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground/80 font-mono truncate">{item.action}</p>
                        {item.value && <p className="text-[10px] text-primary mt-0.5 font-mono">{item.value}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-end">
                          <Clock size={10} />
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                        {item.teeVerified && (
                          <div className="text-[10px] text-green-400 flex items-center gap-1 justify-end mt-0.5">
                            <Shield size={9} /> TEE
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* My Operatives */}
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex justify-between items-center">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Hash size={16} /> My Operatives
              </CardTitle>
              <Link href="/agents/new">
                <div className="text-xs px-2 py-1 bg-primary/20 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/50 transition-colors uppercase tracking-widest cursor-pointer">
                  Deploy New
                </div>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {agentsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/50 animate-pulse border border-border/50" />)}</div>
            ) : !agents?.length ? (
              <div className="text-center p-6 text-muted-foreground text-sm border border-dashed border-border/50 bg-background/30">
                No operatives deployed.<br /><br />
                <Link href="/agents/new"><span className="text-primary hover:underline cursor-pointer">Deploy your first agent</span></Link>
              </div>
            ) : (
              agents.slice(0, 5).map(agent => (
                <Link href={`/agents/${agent.id}`} key={agent.id}>
                  <div className="p-3 border border-border/50 bg-background/50 hover:border-primary/50 transition-all cursor-pointer group flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{agent.name}</div>
                      <div className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${
                        agent.status === 'active' ? 'text-green-400 border-green-400/50 bg-green-400/10' :
                        agent.status === 'executing' ? 'text-primary border-primary/50 bg-primary/10 animate-pulse' :
                        'text-muted-foreground border-border bg-muted/20'
                      }`}>
                        {agent.status}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <div className="text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.5">REP: {agent.reputationScore}</div>
                      <div className="text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.5 uppercase">{agent.personality}</div>
                      {agent.teeVerified && <div className="text-[10px] text-green-400/70 flex items-center gap-0.5"><Shield size={9} /> TEE</div>}
                    </div>
                  </div>
                </Link>
              ))
            )}
            {agents && agents.length > 5 && (
              <Link href="/agents">
                <div className="text-xs text-center text-primary/70 hover:text-primary cursor-pointer p-2 border border-dashed border-primary/30 hover:border-primary/60 transition-colors uppercase tracking-widest">
                  View All Operatives
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ZeroGNetworkPanel({ stats, loading }: { stats: any; loading: boolean }) {
  const metrics = [
    {
      label: "0G Storage",
      icon: <Database size={16} className="text-primary" />,
      value: stats?.storageUsed ?? "-- MB",
      detail: "Agent memory, preferences, history",
      status: "SYNCED",
      color: "primary",
    },
    {
      label: "0G Compute",
      icon: <Cpu size={16} className="text-secondary" />,
      value: `${stats?.teeExecutions ?? "--"} calls`,
      detail: "AI inference, decision engine",
      status: "ACTIVE",
      color: "secondary",
    },
    {
      label: "0G Chain",
      icon: <Hash size={16} className="text-green-400" />,
      value: `${stats?.onChainTxns ?? "--"} txns`,
      detail: "Agent identity, execution proofs",
      status: "ONLINE",
      color: "green",
    },
    {
      label: "TEE Enclave",
      icon: <Shield size={16} className="text-green-400" />,
      value: `${stats?.successRate ? (stats.successRate * 100).toFixed(1) : "--"}% success`,
      detail: "Private sealed execution",
      status: "SEALED",
      color: "green",
    },
  ];

  return (
    <div className="border border-primary/20 bg-primary/3">
      <div className="px-4 py-2.5 border-b border-primary/20 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-primary font-bold flex items-center gap-2">
          <Server size={13} /> 0G Infrastructure Status
        </div>
        <div className="text-[10px] text-green-400 flex items-center gap-1 font-mono">
          <CheckCircle size={10} /> All systems nominal
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/30">
        {metrics.map((m, i) => (
          <div key={i} className="p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              {m.icon} {m.label}
            </div>
            {loading ? (
              <div className="h-5 w-24 bg-muted/50 animate-pulse" />
            ) : (
              <div className={`text-sm font-bold font-mono ${
                m.color === "primary" ? "text-primary" :
                m.color === "secondary" ? "text-secondary" : "text-green-400"
              }`}>
                {m.value}
              </div>
            )}
            <div className="text-[10px] text-muted-foreground/70">{m.detail}</div>
            <div className={`text-[9px] font-mono flex items-center gap-1 ${
              m.color === "primary" ? "text-primary/60" :
              m.color === "secondary" ? "text-secondary/60" : "text-green-400/60"
            }`}>
              <span className={`w-1 h-1 rounded-full animate-pulse ${
                m.color === "primary" ? "bg-primary" :
                m.color === "secondary" ? "bg-secondary" : "bg-green-400"
              }`} />
              {m.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, subValue, icon, loading, className = "" }: {
  title: string; value: string | number; subValue?: string; icon: React.ReactNode; loading: boolean; className?: string;
}) {
  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest leading-tight">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-24 bg-muted/50 animate-pulse" />
        ) : (
          <div className="space-y-0.5">
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground">{value}</div>
            {subValue && <div className="text-xs text-muted-foreground font-mono">{subValue}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
