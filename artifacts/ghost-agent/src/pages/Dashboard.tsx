import React from "react";
import { 
  useGetPlatformStats, 
  getGetPlatformStatsQueryKey,
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
  useGetAgents,
  getGetAgentsQueryKey
} from "@workspace/api-client-react";
import { Activity, Shield, Zap, Hash, Database, Clock, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";

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
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            NOMINAL
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Operatives" 
          value={stats?.activeAgents ?? "--"} 
          subValue={`/ ${stats?.totalAgents ?? "--"} Total`}
          icon={<Zap size={18} className="text-primary" />} 
          loading={statsLoading} 
        />
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <StatCard 
            title="Total Value Managed" 
            value={stats?.totalValueManaged ?? "--"} 
            icon={<Hash size={18} className="text-secondary" />} 
            loading={statsLoading}
            className="border-primary/50 bg-primary/5 relative z-10"
          />
        </div>
        <StatCard 
          title="TEE Executions" 
          value={stats?.teeExecutions ?? "--"} 
          subValue={`${stats?.successRate ?? "--"}% Success Rate`}
          icon={<Shield size={18} className="text-green-400" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="On-Chain Txs" 
          value={stats?.onChainTxns ?? "--"} 
          icon={<Database size={18} className="text-primary" />} 
          loading={statsLoading} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Activity size={16} /> Live Feed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-4">
              {activitiesLoading ? (
                <div className="space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 bg-muted/50 animate-pulse rounded border border-border/50"></div>
                  ))}
                </div>
              ) : activities?.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">No recent activity detected.</div>
              ) : (
                <div className="space-y-3">
                  {activities?.map(item => (
                    <div key={item.id} className="p-3 border border-border/30 bg-background/50 hover:border-primary/50 transition-colors group relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50 transform origin-left scale-y-0 group-hover:scale-y-100 transition-transform"></div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-primary text-sm">{item.agentName}</span>
                            <span className="text-xs uppercase px-1.5 py-0.5 border border-border text-muted-foreground rounded-sm">{item.type}</span>
                            {item.isPrivate && (
                              <span className="text-[10px] uppercase tracking-wider text-secondary flex items-center gap-1">
                                <Shield size={10} /> [ENCRYPTED]
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/80 font-mono">{item.action}</p>
                          {item.value && <p className="text-xs text-primary mt-1">{item.value}</p>}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mb-1">
                            <Clock size={12} />
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                          {item.teeVerified && (
                            <div className="text-[10px] text-green-400 uppercase tracking-widest flex items-center gap-1 justify-end">
                              <Shield size={10} /> TEE Verified
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User Agents */}
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
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-20 bg-muted/50 animate-pulse rounded border border-border/50"></div>
                ))}
              </div>
            ) : agents?.length === 0 ? (
              <div className="text-center p-6 text-muted-foreground text-sm border border-dashed border-border/50 bg-background/30">
                No operatives deployed.<br/><br/>
                <Link href="/agents/new"><span className="text-primary hover:underline cursor-pointer">Deploy your first agent</span></Link>
              </div>
            ) : (
              agents?.slice(0, 5).map(agent => (
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
                    <div className="flex gap-2">
                      <div className="text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.5 rounded-sm">REP: {agent.reputationScore}</div>
                      <div className="text-[10px] text-muted-foreground bg-muted/30 px-1 py-0.5 rounded-sm uppercase">{agent.personality}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
            {agents && agents.length > 5 && (
              <Link href="/agents">
                <div className="text-xs text-center text-primary/70 hover:text-primary mt-4 cursor-pointer p-2 border border-dashed border-primary/30 hover:border-primary/60 transition-colors uppercase tracking-widest">
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

function StatCard({ title, value, subValue, icon, loading, className = "" }: { title: string, value: string | number, subValue?: string, icon: React.ReactNode, loading: boolean, className?: string }) {
  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-24 bg-muted/50 animate-pulse rounded"></div>
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold font-mono text-foreground">{value}</div>
            {subValue && <div className="text-xs text-muted-foreground font-mono">{subValue}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
