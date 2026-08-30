import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { Activity, AlertTriangle, BrainCircuit, CheckCircle2, ChevronRight, Clock3, Eye, Gauge, LockKeyhole, Play, RefreshCw, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiUrl } from "@/lib/api";

const SYMBOLS = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META", "GOOGL"];

async function authFetch(path, options, getToken) {
  const token = await getToken();
  const response = await fetch(getApiUrl(path), { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options?.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data?.error || "Request failed"), { data, status: response.status });
  return data;
}

const money = (value) => value == null || Number.isNaN(Number(value)) ? "—" : `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function Gate({ label, value, pass }) {
  return <div className="flex items-center justify-between border-b border-border/30 py-2 text-xs"><span className="text-muted-foreground">{label}</span><span className={pass ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{pass ? "PASS" : value}</span></div>;
}

export default function Trading() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("SPY");
  const [analysis, setAnalysis] = useState(null);
  const [notice, setNotice] = useState(null);
  const statusQuery = useQuery({ queryKey: ["trading-status"], queryFn: () => authFetch("/api/trading/status", {}, getToken), refetchInterval: 15000 });
  const positionsQuery = useQuery({ queryKey: ["alpaca-positions"], queryFn: () => authFetch("/api/trading/positions", {}, getToken), refetchInterval: 15000 });
  const analyze = useMutation({
    mutationFn: () => authFetch("/api/trading/analyze", { method: "POST", body: JSON.stringify({ symbol }) }, getToken),
    onSuccess: (data) => { setAnalysis(data.analysis); setNotice(null); },
    onError: (err) => setNotice({ type: "error", text: err.message }),
  });
  const execute = useMutation({
    mutationFn: () => authFetch("/api/trading/execute", { method: "POST", body: JSON.stringify({ symbol, analysis }) }, getToken),
    onSuccess: (data) => { setNotice({ type: "success", text: data.skipped ? data.message : `Paper order submitted: ${data.optionSymbol} × ${data.quantity}` }); qc.invalidateQueries({ queryKey: ["trading-status"] }); qc.invalidateQueries({ queryKey: ["alpaca-positions"] }); },
    onError: (err) => setNotice({ type: "error", text: err.message }),
  });
  const status = statusQuery.data;
  const contract = analysis?.optionsContract;
  const ready = analysis?.decision && analysis.decision !== "HOLD";
  const gatesPass = Number(analysis?.confidence) >= 78 && Number(analysis?.confluenceScore) >= 6;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-border/50 pb-4">
        <div><div className="flex items-center gap-2 text-primary text-2xl font-bold uppercase tracking-widest"><Sparkles size={24} /> Options Execute</div><p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Review the thesis. Approve a defined-risk Alpaca paper order.</p></div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Paper environment · {status?.status || "checking"}</div>
      </div>
      {notice && <div className={`border p-3 text-sm flex gap-2 items-center ${notice.type === "error" ? "border-red-500/30 bg-red-500/5 text-red-300" : "border-green-500/30 bg-green-500/5 text-green-300"}`}>{notice.type === "error" ? <XCircle size={15} /> : <CheckCircle2 size={15} />}{notice.text}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Paper equity" value={money(status?.equity)} />
        <Metric label="Buying power" value={money(status?.buyingPower)} />
        <Metric label="Max risk / trade" value="1.00%" accent="text-primary" />
        <Metric label="Confidence gate" value="78%+" accent="text-green-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/30"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><BrainCircuit size={16} /> Decision console</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3"><Select value={symbol} onValueChange={(value) => { setSymbol(value); setAnalysis(null); }}><SelectTrigger className="bg-background/50 border-border/50 flex-1"><SelectValue /></SelectTrigger><SelectContent>{SYMBOLS.map((item) => <SelectItem key={item} value={item}>{item} · US underlying</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => analyze.mutate()} disabled={analyze.isPending}>{analyze.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Eye size={15} />}<span className="ml-2">{analyze.isPending ? "Reading bars" : "Analyze"}</span></Button></div>
            <div className="border border-border/40 bg-background/30 p-4 min-h-[170px]">
              {!analysis ? <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-8"><Activity size={22} className="text-primary/60" /><span className="text-xs uppercase tracking-widest">Select an underlying to start</span><span className="text-[10px]">The agent will read Alpaca historical bars and search the active options chain.</span></div> : <div className="space-y-4">
                <div className="flex items-start justify-between"><div><Badge variant="outline" className={analysis.decision === "BUY_CALL" ? "border-green-500/50 text-green-400" : analysis.decision === "BUY_PUT" ? "border-red-500/50 text-red-400" : "border-yellow-500/50 text-yellow-400"}>{analysis.decision}</Badge><div className="text-2xl font-bold font-mono mt-2">{symbol}</div><div className="text-xs text-muted-foreground">{analysis.timeframe} · {analysis.session}</div></div><div className="text-right"><div className="text-[10px] text-muted-foreground uppercase">Confidence</div><div className={`text-3xl font-bold font-mono ${analysis.confidence >= 78 ? "text-green-400" : "text-yellow-400"}`}>{analysis.confidence}%</div></div></div>
                {contract && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[["Contract", contract.symbol], ["Type", contract.optionType], ["Strike", money(contract.strike)], ["Premium", contract.premium ? money(contract.premium) : "—"]].map(([label, value]) => <div className="border border-primary/20 bg-primary/5 p-2" key={label}><div className="text-[9px] text-muted-foreground uppercase">{label}</div><div className="text-xs text-primary font-bold font-mono mt-1 break-all">{value}</div></div>)}</div>}
                <div className="grid grid-cols-3 gap-2 text-xs font-mono"><div className="border border-border/30 p-2"><div className="text-[9px] text-muted-foreground">UNDERLYING ENTRY</div><div className="font-bold">{money(analysis.entryPrice)}</div></div><div className="border border-red-500/20 bg-red-500/5 p-2"><div className="text-[9px] text-muted-foreground">INVALIDATION</div><div className="font-bold text-red-400">{money(analysis.stopLoss)}</div></div><div className="border border-green-500/20 bg-green-500/5 p-2"><div className="text-[9px] text-muted-foreground">TARGET</div><div className="font-bold text-green-400">{money(analysis.takeProfit)}</div></div></div>
                <p className="text-xs text-foreground/75 leading-relaxed">{analysis.reasoning}</p>
                {analysis.confluenceFactors?.length > 0 && <div className="flex flex-wrap gap-1.5">{analysis.confluenceFactors.map((factor) => <span key={factor} className="text-[10px] border border-green-500/30 text-green-400 px-2 py-1">{factor}</span>)}</div>}
              </div>}
            </div>
            <div className="flex gap-2"><Button className="flex-1 uppercase tracking-widest text-xs" disabled={!ready || !gatesPass || execute.isPending} onClick={() => execute.mutate()}><Play size={14} className="mr-2" />{execute.isPending ? "Submitting paper order" : "Submit paper order"}</Button><Link href="/signals"><Button variant="outline" className="text-xs uppercase tracking-wider">Full audit <ChevronRight size={13} className="ml-1" /></Button></Link></div>
            {analysis && !gatesPass && <div className="text-[10px] text-yellow-400 flex gap-2 items-center"><AlertTriangle size={13} /> Manual execution is blocked until confidence reaches 78% and confluence reaches 6/8.</div>}
          </CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><ShieldCheck size={14} /> Risk gates</CardTitle></CardHeader><CardContent className="p-4"><Gate label="Options-only order" value="WAITING" pass={Boolean(contract)} /><Gate label="AI confidence ≥ 78%" value={`${analysis?.confidence || "—"}%`} pass={Number(analysis?.confidence) >= 78} /><Gate label="Confluence ≥ 6/8" value={`${analysis?.confluenceScore || "—"}/8`} pass={Number(analysis?.confluenceScore) >= 6} /><Gate label="Max account risk" value="1% capped" pass /><Gate label="Paper account guard" value={status?.paper ? "PASS" : "CHECK"} pass={Boolean(status?.paper)} /></CardContent></Card>
          <Card className="border-border/50 bg-card/50 backdrop-blur"><CardHeader className="border-b border-border/30"><CardTitle className="text-xs uppercase tracking-widest text-primary flex items-center gap-2"><Target size={14} /> Open options</CardTitle></CardHeader><CardContent className="p-0">{positionsQuery.isLoading ? <div className="p-4 text-xs text-muted-foreground">Reading Alpaca positions…</div> : !positionsQuery.data?.length ? <div className="p-4 text-xs text-muted-foreground">No open option positions.</div> : positionsQuery.data.map((position) => <div key={position.asset_id || position.symbol} className="p-3 border-b border-border/30 text-xs"><div className="flex justify-between font-bold"><span>{position.symbol}</span><span className={Number(position.unrealized_pl) >= 0 ? "text-green-400" : "text-red-400"}>{money(position.unrealized_pl)}</span></div><div className="text-muted-foreground mt-1">Qty {position.qty} · avg {money(position.avg_entry_price)}</div></div>)}</CardContent></Card>
          <div className="border border-border/30 bg-card/20 p-3 text-[10px] text-muted-foreground flex gap-2"><LockKeyhole size={13} className="text-primary shrink-0" /> Long premium only. Orders are routed to Alpaca's paper endpoint; no live funds are touched.</div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = "" }) { return <div className="border border-border/40 bg-card/40 p-3"><div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div><div className={`text-xl font-bold font-mono mt-1 ${accent}`}>{value}</div></div>; }