import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  BookOpen, TrendingUp, TrendingDown, CheckCircle, XCircle,
  Clock, Save, Filter, BarChart2, Target, Brain, Pencil, X,
  ChevronDown, ChevronUp, Award, Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getApiUrl } from "@/lib/api";

async function authPost(path, body, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { status: res.status });
  return data;
}

async function authGet(path, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatPrice(price, symbol) {
  if (!price || price === "0") return "—";
  const p = Number(price);
  if (symbol?.includes("JPY")) return p.toFixed(3);
  if (symbol?.includes("XAU") || symbol?.includes("XAG")) return p.toFixed(2);
  if (symbol?.includes("BTC") || symbol?.includes("ETH")) return p.toFixed(2);
  return p.toFixed(5);
}

const STATUS_CONFIG = {
  active:  { label: "ACTIVE",   icon: <Clock size={10} />,        color: "border-primary/50 text-primary" },
  tp_hit:  { label: "TP HIT",   icon: <CheckCircle size={10} />,  color: "border-green-500/50 text-green-400" },
  sl_hit:  { label: "SL HIT",   icon: <XCircle size={10} />,      color: "border-red-500/50 text-red-400" },
  expired: { label: "EXPIRED",  icon: <Minus size={10} />,        color: "border-border text-muted-foreground" },
};

function JournalEntry({ signal, onSaveNote, onOutcome }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(signal.journalNote || "");
  const cfg = STATUS_CONFIG[signal.signalStatus] || STATUS_CONFIG.active;

  const handleSave = () => {
    onSaveNote(signal.id, note);
    setEditing(false);
  };

  return (
    <div className="border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(p => !p)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`text-xs font-bold px-2 py-1 border shrink-0 ${signal.type === "BUY" ? "text-green-400 border-green-400/50 bg-green-400/10" : "text-red-400 border-red-400/50 bg-red-400/10"}`}>
            {signal.type === "BUY" ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
            {signal.type}
          </div>
          <span className="font-bold font-mono text-sm">{signal.symbol}</span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.color}`}>
            {cfg.icon} <span className="ml-1">{cfg.label}</span>
          </Badge>
          {signal.confluenceScore > 0 && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {signal.confluenceScore}/8 conf
            </span>
          )}
          {signal.journalNote && (
            <span className="text-[10px] text-primary/70 hidden md:flex items-center gap-1 truncate max-w-[200px]">
              <BookOpen size={9} /> {signal.journalNote}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            {signal.aiConfidence && (
              <div className={`text-xs font-mono font-bold ${Number(signal.aiConfidence) >= 75 ? "text-green-400" : "text-muted-foreground"}`}>
                {Number(signal.aiConfidence).toFixed(0)}%
              </div>
            )}
            <div className="text-[10px] text-muted-foreground">
              {new Date(signal.createdAt).toLocaleDateString()}
            </div>
          </div>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/30 p-4 space-y-4" onClick={e => e.stopPropagation()}>
          {/* Price levels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="border border-border/30 bg-background/30 p-2">
              <div className="text-[10px] text-muted-foreground mb-1">Entry</div>
              <div className="font-bold">{formatPrice(signal.entryPrice, signal.symbol)}</div>
            </div>
            <div className="border border-red-500/20 bg-red-500/5 p-2">
              <div className="text-[10px] text-muted-foreground mb-1">Stop Loss</div>
              <div className="text-red-400 font-bold">{formatPrice(signal.stopLoss, signal.symbol)}</div>
              <div className="text-[10px] text-red-400/60">{signal.stopLossPips} pips</div>
            </div>
            <div className="border border-green-500/20 bg-green-500/5 p-2">
              <div className="text-[10px] text-muted-foreground mb-1">Take Profit</div>
              <div className="text-green-400 font-bold">{formatPrice(signal.takeProfit, signal.symbol)}</div>
              <div className="text-[10px] text-green-400/60">{signal.takeProfitPips} pips</div>
            </div>
            <div className="border border-primary/20 bg-primary/5 p-2">
              <div className="text-[10px] text-muted-foreground mb-1">R:R</div>
              <div className="text-primary font-bold">1:{signal.riskRewardRatio || "N/A"}</div>
              <div className="text-[10px] text-muted-foreground">{signal.riskPercent}% risk</div>
            </div>
          </div>

          {/* AI Reasoning */}
          {signal.aiReasoning && (
            <div className="border border-border/30 bg-background/20 p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Brain size={9} /> AI Reasoning
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">{signal.aiReasoning}</p>
              {signal.forecast && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <div className="text-[10px] text-primary uppercase tracking-wider mb-1">Forecast</div>
                  <p className="text-xs text-foreground/70">{signal.forecast}</p>
                </div>
              )}
            </div>
          )}

          {/* Outcome buttons for active signals */}
          {signal.signalStatus === "active" && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost"
                className="flex-1 text-[10px] uppercase tracking-wider bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30"
                onClick={() => onOutcome(signal.id, "tp_hit")}>
                <CheckCircle size={11} className="mr-1" /> TP Hit
              </Button>
              <Button size="sm" variant="ghost"
                className="flex-1 text-[10px] uppercase tracking-wider bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                onClick={() => onOutcome(signal.id, "sl_hit")}>
                <XCircle size={11} className="mr-1" /> SL Hit
              </Button>
              <Button size="sm" variant="outline"
                className="text-[10px] uppercase tracking-wider"
                onClick={() => onOutcome(signal.id, "expired")}>
                <Clock size={11} className="mr-1" /> Expire
              </Button>
            </div>
          )}

          {/* Journal note editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <BookOpen size={9} /> Trade Journal Note
              </div>
              {!editing && (
                <button
                  className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-1 uppercase tracking-wider"
                  onClick={() => setEditing(true)}>
                  <Pencil size={9} /> {signal.journalNote ? "Edit" : "Add Note"}
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What did you observe? Did you follow your plan? What would you do differently? Key lessons..."
                  className="text-xs bg-background/50 border-border/50 resize-none min-h-[80px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="text-[10px] uppercase tracking-wider flex-1" onClick={handleSave}>
                    <Save size={10} className="mr-1" /> Save Note
                  </Button>
                  <Button size="sm" variant="outline" className="text-[10px] uppercase tracking-wider"
                    onClick={() => { setNote(signal.journalNote || ""); setEditing(false); }}>
                    <X size={10} className="mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : signal.journalNote ? (
              <div className="border-l-2 border-primary/40 pl-3 text-xs text-foreground/80 italic leading-relaxed bg-primary/5 py-2 pr-2">
                {signal.journalNote}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/50 italic">No journal note yet. Click "Add Note" to record your thoughts.</div>
            )}
          </div>

          <div className="text-[10px] text-muted-foreground/40 flex gap-4">
            <span>{new Date(signal.createdAt).toLocaleString()}</span>
            {signal.session && <span>Session: {signal.session}</span>}
            {signal.mt5TicketId && <span>Ticket: {signal.mt5TicketId}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Journal() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [pairFilter, setPairFilter] = useState("all");

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["signal-history"],
    queryFn: () => authGet("/api/signals/history", getToken),
    refetchInterval: 30000,
  });

  const journalMutation = useMutation({
    mutationFn: ({ id, note }) => authPost(`/api/signals/${id}/journal`, { note }, getToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["signal-history"] }),
  });

  const outcomeMutation = useMutation({
    mutationFn: ({ id, outcome }) => authPost(`/api/signals/${id}/outcome`, { outcome }, getToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signal-history"] });
      qc.invalidateQueries({ queryKey: ["signal-status"] });
    },
  });

  // Stats
  const stats = useMemo(() => {
    const closed = history.filter(s => ["tp_hit", "sl_hit"].includes(s.signalStatus));
    const tp = history.filter(s => s.signalStatus === "tp_hit");
    const sl = history.filter(s => s.signalStatus === "sl_hit");
    const winRate = closed.length ? ((tp.length / closed.length) * 100).toFixed(0) : null;
    const withNotes = history.filter(s => s.journalNote);
    const avgConf = history.length
      ? (history.reduce((a, s) => a + Number(s.aiConfidence || 0), 0) / history.length).toFixed(0)
      : null;

    // Best pair
    const pairWins = {};
    tp.forEach(s => { pairWins[s.symbol] = (pairWins[s.symbol] || 0) + 1; });
    const bestPair = Object.entries(pairWins).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Avg RR
    const rrValues = history.filter(s => s.riskRewardRatio && s.riskRewardRatio !== "N/A").map(s => Number(s.riskRewardRatio));
    const avgRR = rrValues.length ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2) : null;

    return { total: history.length, tp: tp.length, sl: sl.length, winRate, withNotes: withNotes.length, bestPair, avgConf, avgRR };
  }, [history]);

  const allPairs = useMemo(() => [...new Set(history.map(s => s.symbol))].sort(), [history]);

  const filtered = useMemo(() => {
    return history.filter(s => {
      if (filter !== "all" && s.signalStatus !== filter) return false;
      if (pairFilter !== "all" && s.symbol !== pairFilter) return false;
      return true;
    });
  }, [history, filter, pairFilter]);

  const filters = [
    { key: "all", label: `All (${history.length})` },
    { key: "active", label: `Active (${history.filter(s => s.signalStatus === "active").length})` },
    { key: "tp_hit", label: `TP Hit (${stats.tp})` },
    { key: "sl_hit", label: `SL Hit (${stats.sl})` },
    { key: "expired", label: `Expired (${history.filter(s => s.signalStatus === "expired").length})` },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <BookOpen size={24} /> Trade Journal
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            Review every signal, record lessons, track your edge
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{stats.withNotes} / {stats.total} notes written</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCell label="Total Signals" value={stats.total} icon={<BarChart2 size={14} />} />
        <StatCell label="TP Hit" value={stats.tp} icon={<CheckCircle size={14} className="text-green-400" />} valueClass="text-green-400" />
        <StatCell label="SL Hit" value={stats.sl} icon={<XCircle size={14} className="text-red-400" />} valueClass="text-red-400" />
        <StatCell label="Win Rate" value={stats.winRate ? `${stats.winRate}%` : "—"} icon={<Target size={14} />} valueClass={stats.winRate && Number(stats.winRate) >= 60 ? "text-green-400" : ""} />
        <StatCell label="Avg R:R" value={stats.avgRR ? `1:${stats.avgRR}` : "—"} icon={<Brain size={14} />} valueClass="text-primary" />
        <StatCell label="Best Pair" value={stats.bestPair || "—"} icon={<Award size={14} className="text-yellow-400" />} valueClass="text-yellow-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={12} className="text-muted-foreground shrink-0" />
        <div className="flex flex-wrap gap-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 border uppercase tracking-wider transition-colors ${filter === f.key ? "border-primary text-primary bg-primary/10" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {allPairs.length > 0 && (
          <select
            value={pairFilter}
            onChange={e => setPairFilter(e.target.value)}
            className="text-[10px] px-2 py-1 border border-border/50 bg-background text-muted-foreground uppercase tracking-wider ml-auto"
          >
            <option value="all">All Pairs</option>
            {allPairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>

      {/* Signal list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 border border-border/30 bg-muted/30 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-mono text-sm space-y-2">
            <BookOpen size={32} className="mx-auto opacity-20 mb-4" />
            <div className="uppercase tracking-widest">No signals found</div>
            <div className="text-xs opacity-60">
              {filter !== "all" ? "Try a different filter" : "Go to Signals to get your first AI signal"}
            </div>
          </div>
        ) : (
          filtered.map(signal => (
            <JournalEntry
              key={signal.id}
              signal={signal}
              onSaveNote={(id, note) => journalMutation.mutate({ id, note })}
              onOutcome={(id, outcome) => outcomeMutation.mutate({ id, outcome })}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, icon, valueClass = "" }) {
  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[10px] uppercase tracking-wider">{label}</span>
        </div>
        <div className={`text-lg font-bold font-mono ${valueClass || "text-foreground"}`}>{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}
