import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Minus, Brain, Zap, AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiUrl } from "@/lib/api";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "USDCAD", "AUDUSD", "USDCHF", "NZDUSD"];

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
  const res = await fetch(getApiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

export default function Trading() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("EURUSD");
  const [analysis, setAnalysis] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: status } = useQuery({
    queryKey: ["trading-status"],
    queryFn: () => authGet("/api/trading/status", getToken),
    refetchInterval: 15000,
  });

  const { data: marketData } = useQuery({
    queryKey: ["market", symbol],
    queryFn: () => authGet(`/api/mt5/market/${symbol}`, getToken),
    refetchInterval: 10000,
    enabled: !!status?.hasMt5,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => authPost("/api/trading/analyze", { symbol }, getToken),
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Analysis failed");
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
      qc.invalidateQueries({ queryKey: ["trade-history"] });
    },
    onError: (err) => {
      setError(err.data?.message || err.message || "Execution failed");
    },
  });

  const canTrade = status?.canTrade;
  const shareRequired = status?.shareRequired;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Brain size={24} /> GhostAgent Trading
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            AI-powered autonomous market analysis
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Trades until share: <span className="text-primary font-bold">{status?.tradesUntilShare ?? "--"}</span></div>
          <div>Total trades: <span className="text-foreground font-bold">{status?.totalTrades ?? "--"}</span></div>
        </div>
      </div>

      {!status?.hasMt5 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-yellow-400 shrink-0" />
          <span className="text-sm text-yellow-300">Connect your MT5 account first to start trading.</span>
          <Link href="/connect-mt5">
            <Button size="sm" variant="outline" className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 ml-auto uppercase text-xs tracking-widest">
              Connect MT5
            </Button>
          </Link>
        </div>
      )}

      {shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <div className="flex-1 text-sm text-red-300">
            GhostAgent's 30% profit share is due. Pay to continue trading.
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest">
              Pay Share
            </Button>
          </Link>
        </div>
      )}

      {Number(status?.balance ?? 0) < 5 && (
        <div className="border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">Minimum $5 balance required to trade.</span>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 ml-auto uppercase text-xs tracking-widest">
              Deposit
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Zap size={16} /> Analyze & Trade
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Select Symbol</label>
              <Select value={symbol} onValueChange={(v) => { setSymbol(v); setAnalysis(null); setLastResult(null); }}>
                <SelectTrigger className="border-border/50 bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {marketData && (
              <div className="border border-border/30 bg-background/30 p-3 space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{symbol} Live Price</div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-muted-foreground">Bid</span>
                  <span className="text-red-400">{Number(marketData.bid).toFixed(5)}</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-muted-foreground">Ask</span>
                  <span className="text-green-400">{Number(marketData.ask).toFixed(5)}</span>
                </div>
                {marketData.change !== undefined && (
                  <div className="flex justify-between text-sm font-mono">
                    <span className="text-muted-foreground">Change</span>
                    <span className={Number(marketData.change) >= 0 ? "text-green-400" : "text-red-400"}>
                      {Number(marketData.change) >= 0 ? "+" : ""}{Number(marketData.change).toFixed(3)}%
                    </span>
                  </div>
                )}
                {marketData.demo && (
                  <div className="text-[10px] text-yellow-400/70 mt-1">DEMO DATA</div>
                )}
              </div>
            )}

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {lastResult && (
              <div className={`border p-3 text-sm ${lastResult.skipped ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-300" : "border-green-500/30 bg-green-500/5 text-green-300"}`}>
                {lastResult.skipped ? (
                  <div className="flex items-center gap-2"><Minus size={14} /> GhostAgent decided to HOLD — no trade placed.</div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <Zap size={14} /> Trade executed!
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lastResult.trade?.type} {lastResult.trade?.symbol} · Vol: {lastResult.trade?.volume}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 uppercase tracking-widest text-xs"
                variant="outline"
                onClick={() => analyzeMutation.mutate()}
                disabled={!canTrade || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <><RefreshCw size={14} className="mr-1 animate-spin" /> Analyzing...</>
                ) : (
                  <><Brain size={14} className="mr-1" /> Analyze</>
                )}
              </Button>
              <Button
                className="flex-1 uppercase tracking-widest text-xs"
                onClick={() => executeMutation.mutate()}
                disabled={!analysis || !canTrade || executeMutation.isPending}
              >
                {executeMutation.isPending ? (
                  <><RefreshCw size={14} className="mr-1 animate-spin" /> Executing...</>
                ) : (
                  <><Zap size={14} className="mr-1" /> Execute</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {analysis && (
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Brain size={16} /> AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {analysis.decision === "BUY" ? (
                    <TrendingUp size={20} className="text-green-400" />
                  ) : analysis.decision === "SELL" ? (
                    <TrendingDown size={20} className="text-red-400" />
                  ) : (
                    <Minus size={20} className="text-yellow-400" />
                  )}
                  <span className={`text-2xl font-bold font-mono ${analysis.decision === "BUY" ? "text-green-400" : analysis.decision === "SELL" ? "text-red-400" : "text-yellow-400"}`}>
                    {analysis.decision}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Confidence</div>
                  <div className="text-xl font-bold font-mono text-primary">{analysis.confidence}%</div>
                </div>
              </div>

              <div className="border border-border/30 bg-background/30 p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Reasoning</div>
                <p className="text-sm text-foreground/90 leading-relaxed">{analysis.reasoning}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                {analysis.entryPrice && (
                  <div>
                    <div className="text-xs text-muted-foreground">Entry</div>
                    <div className="text-foreground">{Number(analysis.entryPrice).toFixed(5)}</div>
                  </div>
                )}
                {analysis.stopLoss && (
                  <div>
                    <div className="text-xs text-muted-foreground">Stop Loss</div>
                    <div className="text-red-400">{Number(analysis.stopLoss).toFixed(5)}</div>
                  </div>
                )}
                {analysis.takeProfit && (
                  <div>
                    <div className="text-xs text-muted-foreground">Take Profit</div>
                    <div className="text-green-400">{Number(analysis.takeProfit).toFixed(5)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">Volume</div>
                  <div className="text-foreground">{analysis.volume}</div>
                </div>
              </div>

              {analysis.forecast && (
                <div className="border border-primary/20 bg-primary/5 p-3">
                  <div className="text-xs text-primary uppercase tracking-wider mb-1">Market Forecast</div>
                  <p className="text-xs text-foreground/80">{analysis.forecast}</p>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                <Brain size={9} /> Model: {analysis.model || "GhostAgent AI"} · Provider: {analysis.provider || "cloudflare"}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
