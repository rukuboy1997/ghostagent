import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Minus, Brain, Zap, AlertCircle, RefreshCw,
  Server, CheckCircle, XCircle, Clock, Shield, Target, BarChart2,
  DollarSign, Activity, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/api";

const SYMBOLS = [
  { value: "EURUSD", label: "EUR/USD" }, { value: "GBPUSD", label: "GBP/USD" },
  { value: "USDJPY", label: "USD/JPY" }, { value: "USDCAD", label: "USD/CAD" },
  { value: "AUDUSD", label: "AUD/USD" }, { value: "USDCHF", label: "USD/CHF" },
  { value: "NZDUSD", label: "NZD/USD" }, { value: "GBPJPY", label: "GBP/JPY" },
  { value: "EURJPY", label: "EUR/JPY" }, { value: "EURGBP", label: "EUR/GBP" },
  { value: "XAUUSD", label: "XAU/USD (Gold)" }, { value: "XAGUSD", label: "XAG/USD (Silver)" },
  { value: "BTCUSD", label: "BTC/USD" }, { value: "ETHUSD", label: "ETH/USD" },
];

async function authPost(path, body, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { status: res.status, data });
  return data;
}

async function authGet(path, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatPrice(price, symbol) {
  if (!price) return "—";
  const p = Number(price);
  if (symbol?.includes("JPY")) return p.toFixed(3);
  if (symbol?.includes("XAU") || symbol?.includes("XAG")) return p.toFixed(2);
  if (symbol?.includes("BTC") || symbol?.includes("ETH")) return p.toFixed(2);
  return p.toFixed(5);
}

function ConfluenceBar({ score }) {
  const max = 8;
  const pct = (score / max) * 100;
  const color = score >= 6 ? "bg-green-400" : score >= 4 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
        <span>Confluence</span>
        <span className={score >= 6 ? "text-green-400" : score >= 4 ? "text-yellow-400" : "text-red-400"}>{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Trading() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("EURUSD");
  const [accountBalance, setAccountBalance] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: status } = useQuery({
    queryKey: ["trading-status"],
    queryFn: () => authGet("/api/trading/status", getToken),
    refetchInterval: 15000,
  });

  const { data: mt5Status, refetch: refetchMt5 } = useQuery({
    queryKey: ["mt5-status"],
    queryFn: () => authGet("/api/mt5/status", getToken),
    refetchInterval: 10000,
  });

  const { data: mt5Account } = useQuery({
    queryKey: ["mt5-account"],
    queryFn: () => authGet("/api/mt5/account", getToken),
    enabled: !!mt5Status?.connected,
    refetchInterval: 30000,
  });

  const { data: positions } = useQuery({
    queryKey: ["mt5-positions"],
    queryFn: () => authGet("/api/mt5/positions", getToken),
    enabled: !!mt5Status?.connected,
    refetchInterval: 15000,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => authPost("/api/trading/analyze", {
      symbol,
      accountBalance: accountBalance ? parseFloat(accountBalance) : undefined,
    }, getToken),
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setError(null);
      setLastResult(null);
    },
    onError: (err) => {
      setError(err.data?.message || err.message || "Analysis failed");
      if (err.status === 402) setError(err.data?.message || err.message);
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => authPost("/api/trading/execute", { symbol, analysis }, getToken),
    onSuccess: (data) => {
      setLastResult(data);
      setAnalysis(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["trading-status"] });
      qc.invalidateQueries({ queryKey: ["mt5-positions"] });
    },
    onError: (err) => {
      setError(err.data?.message || err.message || "Execution failed");
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ id, outcome }) => authPost(`/api/trading/${id}/close`, { outcome }, getToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trading-status"] });
      qc.invalidateQueries({ queryKey: ["mt5-positions"] });
    },
    onError: (err) => setError(err.message),
  });

  const canTrade = status?.canTrade;
  const shareRequired = status?.shareRequired;
  const hasMinBalance = Number(status?.balance ?? 0) >= 10;
  const mt5Connected = mt5Status?.connected;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Zap size={24} /> Auto-Trade
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            GhostAgent executes trades directly on your MT5 account
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-1">
          <div>Profit share: <span className="text-primary font-bold">You 80% / Ghost 20%</span></div>
          <div>Trades until share: <span className={`font-bold ${status?.tradesUntilShare === 0 ? "text-red-400" : "text-foreground"}`}>{status?.tradesUntilShare ?? "--"}</span></div>
        </div>
      </div>

      {!hasMinBalance && (
        <div className="border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">Minimum $10 GhostAgent balance required. Please deposit.</span>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 ml-auto uppercase text-xs tracking-widest">
              Deposit $10
            </Button>
          </Link>
        </div>
      )}

      {!mt5Connected && hasMinBalance && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <Server size={18} className="text-yellow-400 shrink-0" />
          <span className="text-sm text-yellow-300">Connect your MT5 account to enable auto-trading.</span>
          <Link href="/connect-mt5">
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 ml-auto uppercase text-xs tracking-widest">
              Connect MT5 <ArrowRight size={12} className="ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-bold text-red-300 mb-1">GhostAgent Share Required</div>
            <div className="text-xs text-red-300/80">
              You've completed 3 successful trades. Send GhostAgent's 20% profit share to continue trading.
              Remember: Your 80% profit stays in your broker account — GhostAgent only tracks performance.
            </div>
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest shrink-0">
              Pay 20% Share
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button className="text-red-400/50 hover:text-red-400 shrink-0" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Brain size={16} /> Analyze & Execute Trade
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Symbol</label>
                  <Select value={symbol} onValueChange={(v) => { setSymbol(v); setAnalysis(null); setLastResult(null); }}>
                    <SelectTrigger className="border-border/50 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMBOLS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                    <DollarSign size={10} className="inline mr-1" /> Account Balance (USD)
                  </label>
                  <Input
                    type="number"
                    placeholder={status?.tradingBalance ? `$${Number(status.tradingBalance).toFixed(0)}` : "e.g. 500"}
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                    className="bg-background/50 border-border/50 text-sm"
                    min="10"
                  />
                </div>
              </div>

              {lastResult && (
                <div className={`border p-3 text-sm ${lastResult.skipped ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-300" : "border-green-500/30 bg-green-500/5 text-green-300"}`}>
                  {lastResult.skipped ? (
                    <div className="flex items-center gap-2"><Minus size={14} /> {lastResult.message}</div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <CheckCircle size={14} /> Trade Executed on MT5!
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div>{lastResult.trade?.type} {lastResult.trade?.symbol} · Lot: {Number(lastResult.trade?.recommendedLotSize || 0.01).toFixed(2)}</div>
                        {lastResult.mt5TicketId && <div className="text-muted-foreground">Ticket: {lastResult.mt5TicketId}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  className="flex-1 uppercase tracking-widest text-xs"
                  variant="outline"
                  onClick={() => analyzeMutation.mutate()}
                  disabled={!hasMinBalance || analyzeMutation.isPending || shareRequired}
                >
                  {analyzeMutation.isPending ? (
                    <><RefreshCw size={14} className="mr-1 animate-spin" /> Analyzing MT...</>
                  ) : (
                    <><Brain size={14} className="mr-1" /> Analyze Market</>
                  )}
                </Button>
                <Button
                  className="flex-1 uppercase tracking-widest text-xs"
                  onClick={() => executeMutation.mutate()}
                  disabled={!analysis || !canTrade || executeMutation.isPending || !mt5Connected}
                >
                  {executeMutation.isPending ? (
                    <><RefreshCw size={14} className="mr-1 animate-spin" /> Executing...</>
                  ) : (
                    <><Zap size={14} className="mr-1" /> Execute Trade</>
                  )}
                </Button>
              </div>

              {analysis && (
                <div className="border border-primary/20 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {analysis.decision === "BUY" ? <TrendingUp size={20} className="text-green-400" /> : analysis.decision === "SELL" ? <TrendingDown size={20} className="text-red-400" /> : <Minus size={20} className="text-yellow-400" />}
                      <span className={`text-xl font-bold font-mono ${analysis.decision === "BUY" ? "text-green-400" : analysis.decision === "SELL" ? "text-red-400" : "text-yellow-400"}`}>
                        {analysis.decision}
                      </span>
                      <span className="text-xs text-muted-foreground">{symbol}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground">Confidence</div>
                      <div className={`text-xl font-bold font-mono ${analysis.confidence >= 80 ? "text-green-400" : analysis.confidence >= 70 ? "text-yellow-400" : "text-muted-foreground"}`}>
                        {analysis.confidence}%
                      </div>
                    </div>
                  </div>

                  <ConfluenceBar score={analysis.confluenceScore || 0} />

                  {analysis.decision !== "HOLD" && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="border border-border/30 bg-background/30 p-2">
                        <div className="text-[10px] text-muted-foreground mb-1">Entry</div>
                        <div className="font-bold">{formatPrice(analysis.entryPrice, symbol)}</div>
                      </div>
                      <div className="border border-red-500/20 bg-red-500/5 p-2">
                        <div className="text-[10px] text-muted-foreground mb-1">Stop Loss</div>
                        <div className="text-red-400 font-bold">{formatPrice(analysis.stopLoss, symbol)}</div>
                      </div>
                      <div className="border border-green-500/20 bg-green-500/5 p-2">
                        <div className="text-[10px] text-muted-foreground mb-1">Take Profit</div>
                        <div className="text-green-400 font-bold">{formatPrice(analysis.takeProfit, symbol)}</div>
                      </div>
                      <div className="border border-primary/20 bg-primary/5 p-2">
                        <div className="text-[10px] text-muted-foreground mb-1">R:R</div>
                        <div className="text-primary font-bold">1:{analysis.riskRewardRatio}</div>
                      </div>
                    </div>
                  )}

                  <div className="border border-border/30 bg-background/20 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">AI Reasoning</div>
                    <p className="text-xs text-foreground/80 leading-relaxed">{analysis.reasoning}</p>
                  </div>

                  {analysis.confluenceFactors?.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Confluence Factors</div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.confluenceFactors.map((f, i) => (
                          <span key={i} className="text-[10px] border border-green-500/30 text-green-400/80 px-1.5 py-0.5">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.forecast && (
                    <div className="border border-primary/20 bg-primary/5 p-2">
                      <div className="text-[10px] text-primary uppercase tracking-wider mb-1">4-8H Forecast</div>
                      <p className="text-xs text-foreground/80">{analysis.forecast}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                    <span>Session: {analysis.session}</span>
                    <span>Model: DeepSeek-R1 via CF Workers AI</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-xs flex items-center gap-2 text-primary">
                <Server size={14} /> MT5 Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {mt5Connected ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-400 uppercase tracking-wider">
                      {mt5Status?.connectionStatus || mt5Status?.state || "Connected"}
                    </span>
                  </div>
                  {mt5Account && (
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Balance</span>
                        <span className="text-foreground font-bold">${Number(mt5Account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Equity</span>
                        <span className={`font-bold ${Number(mt5Account.equity) >= Number(mt5Account.balance) ? "text-green-400" : "text-red-400"}`}>
                          ${Number(mt5Account.equity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Free Margin</span>
                        <span className="text-foreground">${Number(mt5Account.freeMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leverage</span>
                        <span className="text-foreground">1:{mt5Account.leverage || "--"}</span>
                      </div>
                      {mt5Account.demo && <div className="text-[10px] text-yellow-400/70">DEMO DATA</div>}
                    </div>
                  )}
                  <Link href="/connect-mt5">
                    <Button size="sm" variant="outline" className="w-full text-[10px] uppercase tracking-wider mt-2">
                      Manage Connection
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="text-center space-y-3 py-2">
                  <div className="text-xs text-muted-foreground">No MT5 account connected</div>
                  <Link href="/connect-mt5">
                    <Button size="sm" className="w-full text-[10px] uppercase tracking-wider">
                      <Server size={12} className="mr-1" /> Connect MT5
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {positions?.length > 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="border-b border-border/50 pb-3">
                <CardTitle className="uppercase tracking-widest text-xs flex items-center gap-2 text-primary">
                  <Activity size={14} /> Open Positions ({positions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {positions.map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between p-3 border-b border-border/30 text-xs font-mono">
                    <div>
                      <div className={`font-bold ${pos.type === "POSITION_TYPE_BUY" ? "text-green-400" : "text-red-400"}`}>
                        {pos.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL"} {pos.symbol}
                      </div>
                      <div className="text-muted-foreground">Vol: {pos.volume}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${Number(pos.profit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {Number(pos.profit) >= 0 ? "+" : ""}${Number(pos.profit).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground">{pos.currentPrice}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-xs flex items-center gap-2 text-primary">
                <BarChart2 size={14} /> Trade Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Trades</span>
                <span className="font-bold">{status?.totalTrades ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ghost Balance</span>
                <span className="font-bold text-primary">${Number(status?.balance ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit Split</span>
                <span className="font-bold">You 80% / Ghost 20%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Share Required</span>
                <span className={`font-bold ${shareRequired ? "text-red-400" : "text-green-400"}`}>
                  {shareRequired ? "YES" : "NO"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
