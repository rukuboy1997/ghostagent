import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  TrendingUp, TrendingDown, Minus, Brain, Zap, AlertCircle,
  RefreshCw, BookOpen, CheckCircle, XCircle, Clock, DollarSign,
  Target, Shield, ChevronDown, ChevronUp, Save
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/api";

const SYMBOLS = [
  { value: "EURUSD", label: "EUR/USD — Euro / US Dollar" },
  { value: "GBPUSD", label: "GBP/USD — Pound / US Dollar" },
  { value: "USDJPY", label: "USD/JPY — Dollar / Japanese Yen" },
  { value: "USDCAD", label: "USD/CAD — Dollar / Canadian Dollar" },
  { value: "AUDUSD", label: "AUD/USD — Aussie / US Dollar" },
  { value: "USDCHF", label: "USD/CHF — Dollar / Swiss Franc" },
  { value: "NZDUSD", label: "NZD/USD — Kiwi / US Dollar" },
  { value: "GBPJPY", label: "GBP/JPY — Pound / Japanese Yen" },
  { value: "EURJPY", label: "EUR/JPY — Euro / Japanese Yen" },
  { value: "XAUUSD", label: "XAU/USD — Gold / US Dollar" },
  { value: "XAGUSD", label: "XAG/USD — Silver / US Dollar" },
  { value: "BTCUSD", label: "BTC/USD — Bitcoin / US Dollar" },
  { value: "ETHUSD", label: "ETH/USD — Ethereum / US Dollar" },
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

function DecisionBadge({ decision }) {
  if (decision === "BUY") return (
    <div className="flex items-center gap-2">
      <TrendingUp size={22} className="text-green-400" />
      <span className="text-3xl font-bold font-mono text-green-400">BUY</span>
    </div>
  );
  if (decision === "SELL") return (
    <div className="flex items-center gap-2">
      <TrendingDown size={22} className="text-red-400" />
      <span className="text-3xl font-bold font-mono text-red-400">SELL</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      <Minus size={22} className="text-yellow-400" />
      <span className="text-3xl font-bold font-mono text-yellow-400">HOLD</span>
    </div>
  );
}

function SignalCard({ signal, onOutcome, onJournal }) {
  const [expanded, setExpanded] = useState(false);
  const [journalText, setJournalText] = useState(signal.journalNote || "");
  const [showJournal, setShowJournal] = useState(false);

  const statusColor = {
    active: "text-primary border-primary/50",
    tp_hit: "text-green-400 border-green-400/50",
    sl_hit: "text-red-400 border-red-400/50",
    expired: "text-muted-foreground border-border",
  }[signal.signalStatus] || "text-muted-foreground";

  const statusLabel = {
    active: "ACTIVE",
    tp_hit: "TP HIT ✓",
    sl_hit: "SL HIT ✗",
    expired: "EXPIRED",
  }[signal.signalStatus] || signal.signalStatus;

  return (
    <div className="border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`text-xs font-bold px-2 py-1 border ${signal.type === "BUY" ? "text-green-400 border-green-400/50 bg-green-400/10" : "text-red-400 border-red-400/50 bg-red-400/10"}`}>
            {signal.type}
          </div>
          <span className="text-sm font-bold font-mono">{signal.symbol}</span>
          <Badge variant="outline" className={`text-[10px] uppercase ${statusColor}`}>
            {statusLabel}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(signal.createdAt).toLocaleDateString()} {new Date(signal.createdAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        <div className="border border-border/30 p-2">
          <div className="text-muted-foreground mb-1">Entry</div>
          <div className="text-foreground font-bold">{formatPrice(signal.entryPrice, signal.symbol)}</div>
        </div>
        <div className="border border-red-500/20 p-2">
          <div className="text-muted-foreground mb-1">Stop Loss</div>
          <div className="text-red-400 font-bold">{formatPrice(signal.stopLoss, signal.symbol)}</div>
        </div>
        <div className="border border-green-500/20 p-2">
          <div className="text-muted-foreground mb-1">Take Profit</div>
          <div className="text-green-400 font-bold">{formatPrice(signal.takeProfit, signal.symbol)}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
        <span>Lot: <strong className="text-foreground">{Number(signal.recommendedLotSize || 0).toFixed(2)}</strong></span>
        <span>Risk: <strong className="text-foreground">{signal.riskPercent || 1}%</strong></span>
        <span>R:R <strong className="text-primary">1:{signal.riskRewardRatio || "N/A"}</strong></span>
        {signal.aiConfidence && <span>Confidence: <strong className="text-primary">{Number(signal.aiConfidence).toFixed(0)}%</strong></span>}
      </div>

      {signal.signalStatus === "active" && (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 text-[10px] uppercase tracking-wider bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
            variant="ghost"
            onClick={() => onOutcome(signal.id, "tp_hit")}
          >
            <CheckCircle size={12} className="mr-1" /> TP Hit
          </Button>
          <Button
            size="sm"
            className="flex-1 text-[10px] uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            variant="ghost"
            onClick={() => onOutcome(signal.id, "sl_hit")}
          >
            <XCircle size={12} className="mr-1" /> SL Hit
          </Button>
          <Button
            size="sm"
            className="text-[10px] uppercase tracking-wider"
            variant="outline"
            onClick={() => onOutcome(signal.id, "expired")}
          >
            <Clock size={12} className="mr-1" /> Expire
          </Button>
        </div>
      )}

      <button
        className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expanded ? "Hide" : "Show"} Analysis
      </button>

      {expanded && signal.aiReasoning && (
        <div className="border border-border/30 bg-background/30 p-3 text-xs text-foreground/80 leading-relaxed">
          <div className="text-muted-foreground uppercase tracking-wider mb-1 text-[10px]">AI Reasoning</div>
          {signal.aiReasoning}
          {signal.forecast && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="text-muted-foreground uppercase tracking-wider mb-1 text-[10px]">Forecast</div>
              {signal.forecast}
            </div>
          )}
          {signal.keyLevels && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <div className="text-muted-foreground uppercase tracking-wider mb-1 text-[10px]">Key Levels</div>
              {signal.keyLevels}
            </div>
          )}
        </div>
      )}

      <div>
        <button
          className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 hover:text-primary"
          onClick={() => setShowJournal(!showJournal)}
        >
          <BookOpen size={10} /> {signal.journalNote ? "Edit Journal" : "Add Journal Note"}
        </button>
        {showJournal && (
          <div className="mt-2 flex gap-2">
            <Input
              value={journalText}
              onChange={(e) => setJournalText(e.target.value)}
              placeholder="What did you do with this signal? Notes..."
              className="text-xs h-8 bg-background/50 border-border/50 flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] uppercase h-8 px-3"
              onClick={() => { onJournal(signal.id, journalText); setShowJournal(false); }}
            >
              <Save size={10} className="mr-1" /> Save
            </Button>
          </div>
        )}
        {signal.journalNote && !showJournal && (
          <div className="mt-1 text-[10px] text-muted-foreground italic border-l border-primary/30 pl-2">
            {signal.journalNote}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Signals() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState("EURUSD");
  const [accountBalance, setAccountBalance] = useState("50");
  const [analysis, setAnalysis] = useState(null);
  const [savedSignal, setSavedSignal] = useState(null);
  const [error, setError] = useState(null);
  const [balanceEditing, setBalanceEditing] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["signal-status"],
    queryFn: () => authGet("/api/signals/status", getToken),
    refetchInterval: 15000,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["signal-history"],
    queryFn: () => authGet("/api/signals/history", getToken),
    refetchInterval: 30000,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => authPost("/api/signals/analyze", {
      symbol,
      accountBalance: accountBalance ? parseFloat(accountBalance) : undefined,
    }, getToken),
    onSuccess: (data) => {
      setAnalysis({ ...data.analysis, marketData: data.marketData });
      setError(null);
      setSavedSignal(null);
    },
    onError: (err) => {
      setError(err.data?.message || err.message || "Analysis failed");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => authPost("/api/signals/save", { symbol, analysis }, getToken),
    onSuccess: (data) => {
      setSavedSignal(data.signal);
      setAnalysis(null);
      setError(null);
      qc.invalidateQueries({ queryKey: ["signal-history"] });
      qc.invalidateQueries({ queryKey: ["signal-status"] });
    },
    onError: (err) => {
      setError(err.data?.message || err.message || "Failed to save signal");
    },
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ id, outcome }) => authPost(`/api/signals/${id}/outcome`, { outcome }, getToken),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["signal-history"] });
      qc.invalidateQueries({ queryKey: ["signal-status"] });
      if (data.shareRequired) {
        setError("You've had 3 signals reach TP! Please send GhostAgent's share to continue.");
      }
    },
    onError: (err) => setError(err.message),
  });

  const journalMutation = useMutation({
    mutationFn: ({ id, note }) => authPost(`/api/signals/${id}/journal`, { note }, getToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signal-history"] }),
    onError: (err) => setError(err.message),
  });

  const balanceMutation = useMutation({
    mutationFn: (bal) => authPost("/api/signals/set-balance", { tradingBalance: bal }, getToken),
    onSuccess: () => {
      setBalanceEditing(false);
      qc.invalidateQueries({ queryKey: ["signal-status"] });
    },
  });

  const canGetSignal = status?.canGetSignal !== false;
  const shareRequired = status?.shareRequired;
  const displayBalance = accountBalance || status?.tradingBalance || "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Brain size={24} /> GhostAgent Signals
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            AI-powered high-precision trading signals
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-1">
          <div>TP Signals: <span className="text-primary font-bold">{status?.tpSignalsSinceLastShare ?? 0}</span>/3</div>
          <div>Total: <span className="text-foreground font-bold">{status?.totalTrades ?? 0}</span></div>
        </div>
      </div>

      {shareRequired && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-red-300 font-bold mb-1">Ghost Share Required</div>
            <div className="text-xs text-red-300/80">3 of your signals reached Take Profit! Send GhostAgent's share to unlock more signals.</div>
          </div>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 uppercase text-xs tracking-widest">
              Pay Share
            </Button>
          </Link>
        </div>
      )}

      {error && (
        <div className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <button className="ml-auto text-red-400/50 hover:text-red-400" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Zap size={16} /> Get Signal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                  <DollarSign size={10} className="inline mr-1" />
                  Your Trading Account Balance (USD)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder={status?.tradingBalance ? `Last: $${Number(status.tradingBalance).toFixed(0)}` : "e.g. 500"}
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(e.target.value)}
                    className="bg-background/50 border-border/50 text-sm"
                    min="10"
                  />
                  {accountBalance && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs uppercase shrink-0"
                      onClick={() => balanceMutation.mutate(parseFloat(accountBalance))}
                      disabled={balanceMutation.isPending}
                    >
                      Save
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Used to calculate lot size & risk management (1-2% risk per trade)
                </p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Pair / Market</label>
                <Select value={symbol} onValueChange={(v) => { setSymbol(v); setAnalysis(null); setSavedSignal(null); }}>
                  <SelectTrigger className="border-border/50 bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">Forex</div>
                    {SYMBOLS.filter(s => !["XAUUSD","XAGUSD","BTCUSD","ETHUSD"].includes(s.value)).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Commodities</div>
                    {SYMBOLS.filter(s => ["XAUUSD","XAGUSD"].includes(s.value)).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                    <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Crypto</div>
                    {SYMBOLS.filter(s => ["BTCUSD","ETHUSD"].includes(s.value)).map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {savedSignal && (
                <div className="border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle size={14} /> Signal saved to history!
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {savedSignal.type} {savedSignal.symbol} · Lot {Number(savedSignal.recommendedLotSize).toFixed(2)} · Mark outcome when done
                  </div>
                </div>
              )}

              <Button
                className="w-full uppercase tracking-widest text-xs"
                onClick={() => analyzeMutation.mutate()}
                disabled={!canGetSignal || analyzeMutation.isPending || shareRequired}
              >
                {analyzeMutation.isPending ? (
                  <><RefreshCw size={14} className="mr-2 animate-spin" /> Analyzing Market...</>
                ) : (
                  <><Brain size={14} className="mr-2" /> Get Signal</>
                )}
              </Button>

              {!canGetSignal && !shareRequired && (
                <p className="text-xs text-muted-foreground text-center">Signals temporarily unavailable.</p>
              )}
            </CardContent>
          </Card>

          {analysis && (
            <Card className="border-primary/30 bg-card/50 backdrop-blur">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                  <Target size={16} /> Signal Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <DecisionBadge decision={analysis.decision} />
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</div>
                    <div className={`text-2xl font-bold font-mono ${analysis.confidence >= 75 ? "text-green-400" : analysis.confidence >= 60 ? "text-yellow-400" : "text-muted-foreground"}`}>
                      {analysis.confidence}%
                    </div>
                  </div>
                </div>

                {analysis.decision !== "HOLD" && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-sm font-mono">
                      <div className="border border-border/30 bg-background/30 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Entry Price</div>
                        <div className="font-bold">{formatPrice(analysis.entryPrice, symbol)}</div>
                      </div>
                      <div className="border border-red-500/20 bg-red-500/5 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Stop Loss</div>
                        <div className="text-red-400 font-bold">{formatPrice(analysis.stopLoss, symbol)}</div>
                        <div className="text-[10px] text-red-400/70">{analysis.stopLossPips} pips</div>
                      </div>
                      <div className="border border-green-500/20 bg-green-500/5 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Take Profit</div>
                        <div className="text-green-400 font-bold">{formatPrice(analysis.takeProfit, symbol)}</div>
                        <div className="text-[10px] text-green-400/70">{analysis.takeProfitPips} pips</div>
                      </div>
                      <div className="border border-primary/20 bg-primary/5 p-3">
                        <div className="text-[10px] text-muted-foreground uppercase mb-1">Risk:Reward</div>
                        <div className="text-primary font-bold">1:{analysis.riskRewardRatio}</div>
                      </div>
                    </div>

                    <div className="border border-primary/20 bg-primary/5 p-3">
                      <div className="text-[10px] text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Shield size={10} /> Risk Management
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-muted-foreground">Lot Size:</span>{" "}
                          <span className="text-foreground font-bold">{analysis.recommendedLotSize}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk:</span>{" "}
                          <span className="text-foreground font-bold">{analysis.riskPercent}% of balance</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SL Pips:</span>{" "}
                          <span className="text-red-400 font-bold">{analysis.stopLossPips}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">TP Pips:</span>{" "}
                          <span className="text-green-400 font-bold">{analysis.takeProfitPips}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="border border-border/30 bg-background/30 p-3">
                  <div className="text-[10px] text-muted-foreground uppercase mb-1">AI Reasoning</div>
                  <p className="text-xs text-foreground/90 leading-relaxed">{analysis.reasoning}</p>
                </div>

                {analysis.forecast && (
                  <div className="border border-border/30 bg-background/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Market Forecast</div>
                    <p className="text-xs text-foreground/80">{analysis.forecast}</p>
                  </div>
                )}

                {analysis.keyLevels && (
                  <div className="border border-border/30 bg-background/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1">Key Levels</div>
                    <p className="text-xs text-foreground/80">{analysis.keyLevels}</p>
                  </div>
                )}

                {analysis.decision !== "HOLD" && (
                  <Button
                    className="w-full uppercase tracking-widest text-xs"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? (
                      <><RefreshCw size={14} className="mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save size={14} className="mr-2" /> Save Signal to Track</>
                    )}
                  </Button>
                )}

                <div className="text-[10px] text-muted-foreground/60">
                  Model: {analysis.model || "GhostAgent AI"} · Provider: {analysis.provider || "cloudflare"}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
              <BookOpen size={14} /> Signal History & Journal
            </h3>
            <div className="text-[10px] text-muted-foreground">
              Mark outcomes · Add notes
            </div>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-muted/30 animate-pulse border border-border/30" />)}
            </div>
          ) : !history?.length ? (
            <div className="border border-border/30 p-8 text-center text-muted-foreground text-sm">
              NO SIGNALS YET
              <br />
              <span className="text-xs mt-2 inline-block">Get your first signal to start tracking</span>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {history.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  onOutcome={(id, outcome) => outcomeMutation.mutate({ id, outcome })}
                  onJournal={(id, note) => journalMutation.mutate({ id, note })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
