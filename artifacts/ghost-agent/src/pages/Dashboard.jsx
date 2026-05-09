import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Activity, Brain, AlertCircle, BarChart2,
  Clock, CheckCircle, XCircle, Ghost, Zap, Server, Target, Shield,
  DollarSign, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api";

async function authGet(path, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function Dashboard() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const qc = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const res = await fetch(getApiUrl("/api/auth/sync"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => authGet("/api/auth/me", getToken),
    enabled: isSignedIn,
    retry: false,
  });

  const { data: status } = useQuery({
    queryKey: ["signal-status"],
    queryFn: () => authGet("/api/signals/status", getToken),
    enabled: isSignedIn,
    refetchInterval: 30000,
  });

  const { data: mt5Status } = useQuery({
    queryKey: ["mt5-status"],
    queryFn: () => authGet("/api/mt5/status", getToken),
    enabled: isSignedIn,
    refetchInterval: 30000,
  });

  const { data: signalHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["signal-history"],
    queryFn: () => authGet("/api/signals/history", getToken),
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (isSignedIn && user && !me) {
      syncMutation.mutate();
    }
  }, [isSignedIn, user?.id]);

  const tpCount = signalHistory?.filter((s) => s.signalStatus === "tp_hit").length ?? 0;
  const slCount = signalHistory?.filter((s) => s.signalStatus === "sl_hit").length ?? 0;
  const totalClosed = tpCount + slCount;
  const winRate = totalClosed > 0 ? ((tpCount / totalClosed) * 100).toFixed(0) : "--";
  const activeSignals = signalHistory?.filter((s) => s.signalStatus === "active").length ?? 0;
  const balance = Number(me?.user?.balance ?? 0);
  const hasMinBalance = balance >= 10;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Activity size={24} /> Dashboard
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            Welcome back, {user?.firstName || "Trader"} — DeepSeek-R1 is ready
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Ghost Balance</div>
          <div className={`text-2xl font-bold font-mono ${hasMinBalance ? "text-primary" : "text-orange-400"}`}>
            ${balance.toFixed(2)}
          </div>
        </div>
      </div>

      {!hasMinBalance && (
        <div className="border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">
            Deposit <strong>$10</strong> to your GhostAgent account to start receiving AI trading signals.
          </span>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 ml-auto uppercase text-xs tracking-widest">
              Deposit Now
            </Button>
          </Link>
        </div>
      )}

      {status?.shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <div className="flex-1 text-sm text-red-300">
            <strong>3 TP signals hit!</strong> Send GhostAgent's 20% share to unlock more signals.
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest">
              <Ghost size={12} className="mr-1" /> Pay 20% Share
            </Button>
          </Link>
        </div>
      )}

      {!mt5Status?.connected && hasMinBalance && (
        <div className="border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-center gap-3">
          <Server size={18} className="text-yellow-400 shrink-0" />
          <span className="text-sm text-yellow-300">
            Connect your MT5 account to enable auto-trading and live market analysis.
          </span>
          <Link href="/connect-mt5">
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 ml-auto uppercase text-xs tracking-widest">
              Connect MT5 <ArrowRight size={12} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Signals"
          value={status?.totalTrades ?? "--"}
          sub={`${activeSignals} active`}
          icon={<Brain size={18} className="text-primary" />}
        />
        <StatCard
          title="TP Hit"
          value={tpCount}
          sub={`${status?.tpUntilShare ?? "--"} until share`}
          icon={<CheckCircle size={18} className="text-green-400" />}
          valueClass="text-green-400"
        />
        <StatCard
          title="Win Rate"
          value={winRate !== "--" ? `${winRate}%` : "--"}
          sub={`${tpCount}W / ${slCount}L`}
          icon={<TrendingUp size={18} className="text-green-400" />}
          valueClass={winRate !== "--" && Number(winRate) >= 60 ? "text-green-400" : ""}
        />
        <StatCard
          title="TP Progress"
          value={`${status?.tpSignalsSinceLastShare ?? 0}/3`}
          sub={status?.shareRequired ? "Share required!" : "Until share due"}
          icon={<BarChart2 size={18} className={status?.shareRequired ? "text-red-400" : "text-primary"} />}
          valueClass={status?.shareRequired ? "text-red-400" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Clock size={16} /> Recent Signals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              {historyLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/50 animate-pulse border border-border/50" />)}
                </div>
              ) : !signalHistory?.length ? (
                <div className="text-center p-8 text-muted-foreground font-mono text-sm">
                  NO SIGNALS YET
                  <br />
                  <Link href="/signals">
                    <span className="text-primary hover:underline cursor-pointer mt-2 inline-block">Get your first AI signal</span>
                  </Link>
                </div>
              ) : (
                signalHistory.slice(0, 20).map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Activity size={16} /> Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <StatusRow label="Signal Access" value={status?.canGetSignal ? "ACTIVE" : "LOCKED"} ok={status?.canGetSignal} />
              <StatusRow label="Ghost Balance" value={hasMinBalance ? "FUNDED" : "NEEDS $10"} ok={hasMinBalance} />
              <StatusRow label="Share Due" value={status?.shareRequired ? "YES" : "NO"} ok={!status?.shareRequired} />
              <StatusRow label="MT5 Account" value={mt5Status?.connected ? "CONNECTED" : "NOT SET"} ok={mt5Status?.connected} />
              <StatusRow label="TP Count" value={`${status?.tpSignalsSinceLastShare ?? 0}/3`} ok={(status?.tpSignalsSinceLastShare ?? 0) < 3} />

              <div className="border-t border-border/50 pt-3 space-y-1.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Profit Structure</div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Your share:</span>
                  <span className="text-green-400 font-bold">80%</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Ghost share:</span>
                  <span className="text-primary font-bold">20%</span>
                </div>
                <div className="text-[10px] text-muted-foreground/60 mt-1">After every 3 TP signals</div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Link href="/signals">
                  <Button className="w-full uppercase tracking-widest text-xs" disabled={!status?.canGetSignal}>
                    <Brain size={14} className="mr-1" /> Get Signal
                  </Button>
                </Link>
                <Link href="/trading">
                  <Button variant="outline" className="w-full uppercase tracking-widest text-xs" disabled={!mt5Status?.connected}>
                    <Zap size={14} className="mr-1" /> Auto-Trade
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-xs flex items-center gap-2 text-primary">
                <Shield size={12} /> Signal Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> Multi-timeframe (D1/H4/H1)
              </div>
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> 6+ indicator confluence required
              </div>
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> Min 72% confidence threshold
              </div>
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> Min 1:2.5 risk-reward ratio
              </div>
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> ATR-based stop loss calculation
              </div>
              <div className="flex items-center gap-2 text-green-400/80">
                <CheckCircle size={10} /> DeepSeek-R1 AI reasoning
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, valueClass = "" }) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-widest leading-tight">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="space-y-0.5">
          <div className={`text-xl sm:text-2xl font-bold font-mono text-foreground ${valueClass}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground font-mono">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, value, ok }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground uppercase text-xs tracking-wider">{label}</span>
      <span className={`font-mono font-bold text-xs ${ok ? "text-green-400" : "text-red-400"}`}>{value}</span>
    </div>
  );
}

function SignalRow({ signal }) {
  const statusStyles = {
    active: { label: "ACTIVE", color: "text-primary border-primary/50" },
    tp_hit: { label: "TP HIT", color: "text-green-400 border-green-400/50" },
    sl_hit: { label: "SL HIT", color: "text-red-400 border-red-400/50" },
    expired: { label: "EXPIRED", color: "text-muted-foreground border-border" },
  }[signal.signalStatus] || { label: signal.signalStatus, color: "text-muted-foreground" };

  return (
    <div className="flex items-center justify-between p-3 border-b border-border/30 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`text-xs font-bold px-1.5 py-0.5 border ${signal.type === "BUY" ? "text-green-400 border-green-400/50 bg-green-400/10" : "text-red-400 border-red-400/50 bg-red-400/10"}`}>
          {signal.type}
        </div>
        <div>
          <div className="text-sm font-bold font-mono">{signal.symbol}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(signal.createdAt).toLocaleDateString()} ·
            {signal.confluenceScore ? <span className="text-primary ml-1">{signal.confluenceScore}/8 conf</span> : ""}
          </div>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="outline" className={`text-[10px] uppercase ${statusStyles.color}`}>
          {statusStyles.label}
        </Badge>
        {signal.aiConfidence && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{Number(signal.aiConfidence).toFixed(0)}% AI</div>
        )}
      </div>
    </div>
  );
}
