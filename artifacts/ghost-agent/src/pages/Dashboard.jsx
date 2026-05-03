import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Activity, Brain, AlertCircle, BarChart2, Clock, CheckCircle, XCircle, Ghost } from "lucide-react";
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Activity size={24} /> Dashboard
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            Welcome back, {user?.firstName || "Trader"}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">GhostAgent Balance</div>
          <div className="text-2xl font-bold text-primary font-mono">
            ${Number(me?.user?.balance ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {status?.shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <div className="flex-1 text-sm text-red-300">
            <strong>3 TP signals hit!</strong> Send GhostAgent's share to unlock more signals.
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest">
              <Ghost size={12} className="mr-1" /> Pay Share
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
        />
        <StatCard
          title="TP Progress"
          value={`${status?.tpSignalsSinceLastShare ?? 0}/3`}
          sub="Share threshold"
          icon={<BarChart2 size={18} className="text-primary" />}
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
                    <span className="text-primary hover:underline cursor-pointer mt-2 inline-block">Get your first signal</span>
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

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Activity size={16} /> Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <StatusRow label="Signal Access" value={status?.canGetSignal ? "ACTIVE" : "LOCKED"} ok={status?.canGetSignal} />
            <StatusRow label="Share Due" value={status?.shareRequired ? "YES" : "NO"} ok={!status?.shareRequired} />
            <StatusRow label="TP Signals" value={`${status?.tpSignalsSinceLastShare ?? 0}/3`} ok={(status?.tpSignalsSinceLastShare ?? 0) < 3} />

            <div className="border-t border-border/50 pt-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Ghost Share Rule</div>
              <p className="text-xs text-foreground/70 leading-relaxed">
                After every 3 TP signals, send GhostAgent's share to continue. Share amount is determined by your results.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/signals">
                <Button className="w-full uppercase tracking-widest text-xs" disabled={!status?.canGetSignal}>
                  <Brain size={14} className="mr-1" /> Get Signal
                </Button>
              </Link>
              <Link href="/account">
                <Button variant="outline" className="w-full uppercase tracking-widest text-xs">
                  <Ghost size={14} className="mr-1" /> Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
          <div className="text-xs text-muted-foreground">{new Date(signal.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="outline" className={`text-[10px] uppercase ${statusStyles.color}`}>
          {statusStyles.label}
        </Badge>
        {signal.recommendedLotSize && (
          <div className="text-[10px] text-muted-foreground mt-0.5">Lot {Number(signal.recommendedLotSize).toFixed(2)}</div>
        )}
      </div>
    </div>
  );
}
