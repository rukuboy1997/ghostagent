import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import { Activity, ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, Database, Landmark, LockKeyhole, Radar, ShieldCheck, Sparkles, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";

async function authFetch(path, options, getToken) {
  const token = await getToken();
  const response = await fetch(getApiUrl(path), { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed");
  return data;
}

const money = (value) => value == null ? "—" : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Dashboard() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => authFetch("/api/auth/me", {}, getToken), enabled: isSignedIn });
  const status = useQuery({ queryKey: ["trading-status"], queryFn: () => authFetch("/api/trading/status", {}, getToken), enabled: isSignedIn, refetchInterval: 15000 });
  const history = useQuery({ queryKey: ["signal-history"], queryFn: () => authFetch("/api/signals/history", {}, getToken), enabled: isSignedIn });
  const alpaca = useQuery({ queryKey: ["alpaca-status"], queryFn: () => authFetch("/api/alpaca/status", {}, getToken), enabled: isSignedIn, refetchInterval: 30000 });
  const sync = useMutation({ mutationFn: () => authFetch("/api/auth/sync", { method: "POST", body: JSON.stringify({ email: user?.primaryEmailAddress?.emailAddress, name: user?.fullName }) }, getToken), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) });
  useEffect(() => { if (isSignedIn && user && !me.data) sync.mutate(); }, [isSignedIn, user?.id]);
  const trades = history.data || [];
  const closed = trades.filter((trade) => ["tp_hit", "sl_hit"].includes(trade.signalStatus));
  const wins = closed.filter((trade) => trade.signalStatus === "tp_hit").length;
  const winRate = closed.length ? `${Math.round((wins / closed.length) * 100)}%` : "—";
  const active = trades.filter((trade) => trade.signalStatus === "active").length;
  const connected = alpaca.data?.connected || alpaca.data?.configured;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-border/50 pb-4"><div><div className="flex items-center gap-2 text-primary text-2xl font-bold uppercase tracking-widest"><Activity size={24} /> Command center</div><p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Welcome back, {user?.firstName || "operator"} · Autonomous options research at a glance</p></div><div className="text-right"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Paper equity</div><div className="text-2xl font-bold font-mono text-primary">{money(status.data?.equity)}</div></div></div>
      {!connected && <Link href="/alpaca"><div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3 text-yellow-300 text-sm"><Landmark size={18} /><span className="flex-1">Alpaca paper connection needs attention before the agent can research.</span><ArrowUpRight size={16} /></div></Link>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Metric label="Account status" value={status.data?.status || "CHECKING"} accent={status.data?.status === "ACTIVE" ? "text-green-400" : "text-yellow-400"} /><Metric label="Buying power" value={money(status.data?.buyingPower)} /><Metric label="Active positions" value={status.data?.totalTrades ?? "—"} /><Metric label="Closed win rate" value={winRate} accent="text-primary" /></div>
      <div className="border border-primary/20 bg-primary/5 p-4"><div className="flex flex-col md:flex-row md:items-center gap-4"><div className="w-11 h-11 border border-primary/30 bg-primary/10 flex items-center justify-center text-primary"><Sparkles size={22} /></div><div className="flex-1"><div className="text-sm font-bold uppercase tracking-widest text-primary">GhostAgent / Options Alpha</div><p className="text-xs text-foreground/70 mt-1 leading-relaxed">DeepSeek-R1 reads Alpaca historical bars, scores eight confluence factors, selects a live contract from the options chain, then waits for explicit risk gates before a paper order.</p></div><Link href="/trading"><Button size="sm" className="text-[10px] uppercase tracking-wider">Open console <ArrowUpRight size={13} className="ml-1" /></Button></Link></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30 flex flex-row items-center justify-between"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><Clock3 size={15} /> Decision ledger</CardTitle><Link href="/journal"><Button variant="ghost" size="sm" className="text-[10px] uppercase">View all</Button></Link></CardHeader><CardContent className="p-0">{history.isLoading ? <div className="p-5 text-xs text-muted-foreground">Loading ledger…</div> : !trades.length ? <div className="p-8 text-center text-xs text-muted-foreground"><BrainCircuit className="mx-auto mb-3 text-primary/50" size={24} />No paper decisions yet.<br /><Link href="/signals"><span className="inline-block mt-2 text-primary hover:underline">Run the first analysis</span></Link></div> : trades.slice(0, 8).map((trade) => <LedgerRow key={trade.id} trade={trade} />)}</CardContent></Card>
        <div className="space-y-4"><Card className="border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Radar size={14} /> Agent state</CardTitle></CardHeader><CardContent className="p-4 space-y-3"><Status label="Alpaca paper" value={connected ? "CONNECTED" : "SETUP"} pass={Boolean(connected)} /><Status label="Autonomous mode" value={status.data?.autoTradeEnabled ? "ARMED" : "MANUAL"} pass={!status.data?.autoTradeEnabled} /><Status label="Historical bars" value="IEX / D1 + H1" pass /><Status label="Risk gate" value="1% MAX" pass /><div className="pt-2 flex gap-2"><Link href="/watchlist" className="flex-1"><Button variant="outline" className="w-full text-[10px] uppercase">Configure</Button></Link><Link href="/alpaca" className="flex-1"><Button variant="outline" className="w-full text-[10px] uppercase">Account</Button></Link></div></CardContent></Card><Card className="border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck size={14} /> Guardrails</CardTitle></CardHeader><CardContent className="p-4 space-y-2 text-[10px] text-green-400"><div className="flex gap-2"><CheckCircle2 size={13} /> Options-only execution</div><div className="flex gap-2"><CheckCircle2 size={13} /> 78% confidence minimum</div><div className="flex gap-2"><CheckCircle2 size={13} /> 6/8 confluence minimum</div><div className="flex gap-2"><CheckCircle2 size={13} /> Paper endpoint enforced</div></CardContent></Card></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Evidence icon={<Database />} title="Market data" value="Alpaca historical bars" /><Evidence icon={<Target />} title="Contract layer" value="Calls / puts selected from chain" /><Evidence icon={<LockKeyhole />} title="Execution" value="Paper orders only" /></div>
    </div>
  );
}

function Metric({ label, value, accent = "" }) { return <div className="border border-border/40 bg-card/40 p-3"><div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div><div className={`mt-1 text-xl font-bold font-mono ${accent}`}>{value}</div></div>; }
function Status({ label, value, pass }) { return <div className="flex justify-between text-xs"><span className="text-muted-foreground uppercase tracking-wider">{label}</span><span className={pass ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{value}</span></div>; }
function LedgerRow({ trade }) { const call = trade.type === "BUY_CALL"; return <div className="flex items-center justify-between p-3 border-b border-border/30 hover:bg-muted/10"><div className="flex items-center gap-3"><div className={`text-[10px] border px-1.5 py-1 font-bold ${call ? "text-green-400 border-green-500/40" : "text-red-400 border-red-500/40"}`}>{call ? "CALL" : "PUT"}</div><div><div className="text-sm font-bold font-mono">{trade.symbol}</div><div className="text-[10px] text-muted-foreground">{trade.optionSymbol || "Contract pending"} · {trade.signalStatus}</div></div></div><div className="text-right text-[10px] text-muted-foreground">{trade.aiConfidence ? `${Number(trade.aiConfidence).toFixed(0)}% AI` : "—"}<div>{trade.createdAt ? new Date(trade.createdAt).toLocaleDateString() : ""}</div></div></div>; }
function Evidence({ icon, title, value }) { return <div className="border border-border/40 bg-card/30 p-3 flex items-center gap-3"><div className="text-primary">{icon}</div><div><div className="text-[10px] text-muted-foreground uppercase">{title}</div><div className="text-xs font-bold mt-1">{value}</div></div></div>; }