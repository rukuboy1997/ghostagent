import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, DollarSign, Activity, Plug, AlertCircle, RefreshCw, BarChart2, Clock } from "lucide-react";
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
    queryKey: ["trading-status"],
    queryFn: () => authGet("/api/trading/status", getToken),
    enabled: isSignedIn,
    refetchInterval: 30000,
  });

  const { data: tradeHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["trade-history"],
    queryFn: () => authGet("/api/trading/history", getToken),
    enabled: isSignedIn,
  });

  useEffect(() => {
    if (isSignedIn && user && !me) {
      syncMutation.mutate();
    }
  }, [isSignedIn, user?.id]);

  const totalPL = tradeHistory?.reduce((sum, t) => sum + Number(t.userProfit || 0), 0) ?? 0;
  const winCount = tradeHistory?.filter((t) => t.status === "profit").length ?? 0;
  const totalClosed = tradeHistory?.filter((t) => t.status !== "open" && t.status !== "pending").length ?? 0;
  const winRate = totalClosed > 0 ? ((winCount / totalClosed) * 100).toFixed(0) : "--";

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
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Portfolio Balance</div>
          <div className="text-2xl font-bold text-primary font-mono">
            ${Number(me?.user?.balance ?? 0).toFixed(2)}
          </div>
        </div>
      </div>

      {!me?.user?.mt5AccountId && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-yellow-400 shrink-0" />
          <div className="flex-1 text-sm text-yellow-300">
            No MT5 account connected. Connect your broker account to start trading.
          </div>
          <Link href="/connect-mt5">
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 uppercase text-xs tracking-widest">
              <Plug size={14} className="mr-1" /> Connect MT5
            </Button>
          </Link>
        </div>
      )}

      {status?.shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <div className="flex-1 text-sm text-red-300">
            GhostAgent's 30% share is due. Pay to unlock your next {3} trades.
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest">
              Pay Share
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Balance"
          value={`$${Number(me?.user?.balance ?? 0).toFixed(2)}`}
          sub={me?.user?.currency || "USD"}
          icon={<DollarSign size={18} className="text-primary" />}
        />
        <StatCard
          title="Total Trades"
          value={status?.totalTrades ?? "--"}
          sub={`${status?.tradesUntilShare ?? "--"} until share`}
          icon={<BarChart2 size={18} className="text-secondary" />}
        />
        <StatCard
          title="Win Rate"
          value={winRate !== "--" ? `${winRate}%` : "--"}
          sub={`${winCount}/${totalClosed} trades`}
          icon={<TrendingUp size={18} className="text-green-400" />}
        />
        <StatCard
          title="Total P&L"
          value={`$${totalPL.toFixed(2)}`}
          sub="Your 70% share"
          icon={totalPL >= 0 ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
          valueClass={totalPL >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Clock size={16} /> Recent Trades
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto">
              {historyLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/50 animate-pulse border border-border/50" />)}
                </div>
              ) : !tradeHistory?.length ? (
                <div className="text-center p-8 text-muted-foreground font-mono text-sm">
                  NO TRADES YET
                  <br />
                  <Link href="/trading">
                    <span className="text-primary hover:underline cursor-pointer mt-2 inline-block">Start your first trade</span>
                  </Link>
                </div>
              ) : (
                tradeHistory.slice(0, 20).map((trade) => (
                  <TradeRow key={trade.id} trade={trade} />
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
            <StatusRow label="MT5 Connected" value={status?.hasMt5 ? "YES" : "NO"} ok={status?.hasMt5} />
            <StatusRow label="Balance OK" value={Number(status?.balance) >= 5 ? "YES" : "NO"} ok={Number(status?.balance) >= 5} />
            <StatusRow label="Can Trade" value={status?.canTrade ? "YES" : "NO"} ok={status?.canTrade} />
            <StatusRow label="Share Due" value={status?.shareRequired ? "YES" : "NO"} ok={!status?.shareRequired} />

            <div className="border-t border-border/50 pt-4 space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Profit Split</div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/70">You</span>
                <span className="text-green-400 font-bold font-mono">70%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/70">GhostAgent</span>
                <span className="text-primary font-bold font-mono">30%</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href="/trading">
                <Button className="w-full uppercase tracking-widest text-xs" disabled={!status?.canTrade}>
                  <TrendingUp size={14} className="mr-1" /> Trade Now
                </Button>
              </Link>
              <Link href="/account">
                <Button variant="outline" className="w-full uppercase tracking-widest text-xs">
                  <DollarSign size={14} className="mr-1" /> Deposit
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

function TradeRow({ trade }) {
  const isOpen = trade.status === "open";
  const isProfit = trade.status === "profit";
  const isLoss = trade.status === "loss";

  return (
    <div className="flex items-center justify-between p-3 border-b border-border/30 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`text-xs font-bold px-1.5 py-0.5 border ${trade.type === "BUY" ? "text-green-400 border-green-400/50 bg-green-400/10" : "text-red-400 border-red-400/50 bg-red-400/10"}`}>
          {trade.type}
        </div>
        <div>
          <div className="text-sm font-bold font-mono">{trade.symbol}</div>
          <div className="text-xs text-muted-foreground">{new Date(trade.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-mono font-bold ${isProfit ? "text-green-400" : isLoss ? "text-red-400" : "text-muted-foreground"}`}>
          {isOpen ? (
            <Badge variant="outline" className="text-[10px] uppercase text-primary border-primary/50">OPEN</Badge>
          ) : (
            `${isProfit ? "+" : ""}$${Number(trade.userProfit || 0).toFixed(2)}`
          )}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase">{trade.status}</div>
      </div>
    </div>
  );
}
