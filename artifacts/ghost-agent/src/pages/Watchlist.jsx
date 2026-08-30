import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Bell, Check, ChevronRight, CircleHelp, Clock3, Cpu, Eye, LockKeyhole, Pause, Play, ScanLine, ShieldCheck, SlidersHorizontal, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";

const UNDERLYINGS = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META", "GOOGL"];
const INTERVALS = [5, 10, 15, 30];

async function authFetch(path, options, getToken) {
  const token = await getToken();
  const response = await fetch(getApiUrl(path), { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function Watchlist() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data: watchlist, isLoading } = useQuery({ queryKey: ["watchlist"], queryFn: () => authFetch("/api/watchlist", {}, getToken), refetchInterval: 30000 });
  const [pairs, setPairs] = useState([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (watchlist) { setPairs(watchlist.pairs || []); setDirty(false); } }, [watchlist]);
  const save = useMutation({ mutationFn: (next) => authFetch("/api/watchlist/pairs", { method: "PUT", body: JSON.stringify({ pairs: next }) }, getToken), onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlist"] }); setDirty(false); } });
  const settings = useMutation({ mutationFn: (body) => authFetch("/api/watchlist/settings", { method: "PATCH", body: JSON.stringify(body) }, getToken), onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }) });
  const scanEnabled = Boolean(watchlist?.scanEnabled);
  const autoTradeEnabled = Boolean(watchlist?.autoTradeEnabled);
  const toggle = (symbol) => { const next = pairs.includes(symbol) ? pairs.filter((item) => item !== symbol) : [...pairs, symbol]; setPairs(next); setDirty(true); };
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-border/50 pb-4"><div><div className="flex items-center gap-2 text-primary text-2xl font-bold uppercase tracking-widest"><ScanLine size={24} /> Agent Watchlist</div><p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Choose the underlyings GhostAgent is allowed to research.</p></div><Badge variant="outline" className={scanEnabled ? "border-green-500/50 text-green-400" : "border-border/50 text-muted-foreground"}>{scanEnabled ? "SCANNER ACTIVE" : "SCANNER PAUSED"}</Badge></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-sm uppercase tracking-widest text-primary flex justify-between"><span className="flex items-center gap-2"><Eye size={15} /> US underlyings</span><span className="text-[10px] text-muted-foreground">{pairs.length}/10 selected</span></CardTitle></CardHeader><CardContent className="p-4"><div className="grid grid-cols-2 sm:grid-cols-5 gap-2">{UNDERLYINGS.map((symbol) => { const selected = pairs.includes(symbol); return <button key={symbol} onClick={() => toggle(symbol)} className={`border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}><div className="flex justify-between items-center"><span className="font-bold font-mono">{symbol}</span>{selected && <Check size={14} />}</div><div className="text-[9px] uppercase tracking-wider mt-2">{selected ? "armed" : "available"}</div></button>; })}</div>{dirty && <div className="flex gap-2 mt-4 pt-4 border-t border-border/30"><Button className="flex-1 uppercase tracking-widest text-xs" onClick={() => save.mutate(pairs)} disabled={save.isPending}>{save.isPending ? "Saving" : `Save ${pairs.length} underlyings`}</Button><Button variant="outline" className="text-xs uppercase" onClick={() => { setPairs(watchlist?.pairs || []); setDirty(false); }}>Reset</Button></div>}</CardContent></Card>
        <div className="space-y-4">
          <Card className={`border-border/50 bg-card/50 backdrop-blur ${scanEnabled ? "border-primary/40" : ""}`}><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Cpu size={14} /> Autonomous mode</CardTitle></CardHeader><CardContent className="p-4 space-y-4"><div className="flex justify-between items-start"><div><div className="text-sm font-bold">{scanEnabled ? "Research is running" : "Research is paused"}</div><p className="text-[10px] text-muted-foreground mt-1">Alpaca historical bars · US market hours</p></div><button onClick={() => settings.mutate({ scanEnabled: !scanEnabled })} disabled={!pairs.length || settings.isPending} className={`w-12 h-6 rounded-full p-1 transition-colors ${scanEnabled ? "bg-primary" : "bg-muted"}`} aria-label="Toggle autonomous scan"><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${scanEnabled ? "translate-x-6" : ""}`} /></button></div><div className="border-t border-border/30 pt-3 flex justify-between text-xs"><span className="text-muted-foreground">Last scan</span><span>{watchlist?.lastScannedAt ? new Date(watchlist.lastScannedAt).toLocaleTimeString() : "Not yet"}</span></div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Interval</span><span className="text-primary font-bold">{watchlist?.scanIntervalMinutes || 15} min</span></div></CardContent></Card>
          <Card className={`border-border/50 bg-card/50 backdrop-blur ${autoTradeEnabled ? "border-amber-500/40" : ""}`}><CardContent className="p-4 space-y-3"><div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold"><Zap size={14} className={autoTradeEnabled ? "text-amber-400" : "text-muted-foreground"} /> Paper execution</div><p className="text-[10px] text-muted-foreground leading-relaxed">When enabled, qualifying signals can submit long call/put orders to Alpaca paper. The 1% risk and 3-contract caps still apply.</p><Button variant={autoTradeEnabled ? "default" : "outline"} className="w-full text-[10px] uppercase tracking-wider" onClick={() => settings.mutate({ autoTradeEnabled: !autoTradeEnabled })} disabled={settings.isPending || !pairs.length}>{autoTradeEnabled ? <><Pause size={13} className="mr-2" /> Disable execution</> : <><Play size={13} className="mr-2" /> Enable paper execution</>}</Button></CardContent></Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Clock3 size={14} /> Scan cadence</CardTitle></CardHeader><CardContent className="p-3 space-y-1.5">{INTERVALS.map((minutes) => <button key={minutes} onClick={() => settings.mutate({ scanIntervalMinutes: minutes })} className={`w-full border px-3 py-2 text-left text-xs ${Number(watchlist?.scanIntervalMinutes || 15) === minutes ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:text-foreground"}`}><span className="font-bold">{minutes} minutes</span><span className="block text-[10px] opacity-70">{minutes === 15 ? "recommended for demo" : minutes < 15 ? "more responsive" : "lower request volume"}</span></button>)}</CardContent></Card>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Info icon={<ShieldCheck />} title="Defined risk" text="1% maximum account risk per order" /><Info icon={<Bell />} title="Explainable alerts" text="Every qualifying thesis includes confluence" /><Info icon={<LockKeyhole />} title="Paper guard" text="No live orders or fund transfers" /></div>
      <Link href="/alpaca"><div className="border border-primary/20 bg-primary/5 p-3 text-xs text-primary flex items-center justify-between hover:bg-primary/10 cursor-pointer">Review Alpaca paper-account status <ChevronRight size={15} /></div></Link>
    </div>
  );
}

function Info({ icon, title, text }) { return <div className="border border-border/40 bg-card/30 p-3 flex gap-3"><div className="text-primary">{icon}</div><div><div className="text-xs font-bold uppercase tracking-wider">{title}</div><div className="text-[10px] text-muted-foreground mt-1">{text}</div></div></div>; }