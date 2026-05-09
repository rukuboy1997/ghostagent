import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  ScanLine, Plus, X, Bell, BellOff, Clock, Zap,
  TrendingUp, CheckCircle, AlertCircle, Radio, Timer,
  Globe, Sun, ToggleLeft, ToggleRight, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";
import { useNotifications } from "@/components/NotificationProvider";

const ALL_SYMBOLS = [
  { value: "EURUSD",  label: "EUR/USD",  group: "Forex Major" },
  { value: "GBPUSD",  label: "GBP/USD",  group: "Forex Major" },
  { value: "USDJPY",  label: "USD/JPY",  group: "Forex Major" },
  { value: "USDCAD",  label: "USD/CAD",  group: "Forex Major" },
  { value: "AUDUSD",  label: "AUD/USD",  group: "Forex Major" },
  { value: "USDCHF",  label: "USD/CHF",  group: "Forex Major" },
  { value: "NZDUSD",  label: "NZD/USD",  group: "Forex Major" },
  { value: "GBPJPY",  label: "GBP/JPY",  group: "Forex Cross" },
  { value: "EURJPY",  label: "EUR/JPY",  group: "Forex Cross" },
  { value: "EURGBP",  label: "EUR/GBP",  group: "Forex Cross" },
  { value: "XAUUSD",  label: "XAU/USD",  group: "Commodities" },
  { value: "XAGUSD",  label: "XAG/USD",  group: "Commodities" },
  { value: "BTCUSD",  label: "BTC/USD",  group: "Crypto" },
  { value: "ETHUSD",  label: "ETH/USD",  group: "Crypto" },
];

const INTERVALS = [
  { value: 5,  label: "5 min",  desc: "Most responsive — higher API usage" },
  { value: 10, label: "10 min", desc: "Balanced — recommended for most pairs" },
  { value: 15, label: "15 min", desc: "Default — optimal cost vs. speed" },
  { value: 30, label: "30 min", desc: "Lowest cost — good for swing trading" },
];

const SESSION_FILTERS = [
  { value: "major",       label: "London + NY",   desc: "Best liquidity windows (recommended)", icon: <TrendingUp size={12} /> },
  { value: "london_only", label: "London Only",    desc: "08:00–17:00 UTC only",                 icon: <Sun size={12} /> },
  { value: "all",         label: "All Sessions",  desc: "24/5 — includes Asian (lower vol.)",  icon: <Globe size={12} /> },
];

async function authFetch(path, options, getToken) {
  const token = await getToken();
  const res = await fetch(getApiUrl(path), {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

export default function Watchlist() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { permission, connected, lastSignal, requestPermission } = useNotifications();

  const [pendingPairs, setPendingPairs] = useState(null);
  const [dirty, setDirty] = useState(false);

  const { data: wl, isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => authFetch("/api/watchlist", {}, getToken),
    staleTime: 30000,
  });

  // Sync local pairs from server on first load
  useEffect(() => {
    if (wl && pendingPairs === null) setPendingPairs(wl.pairs || []);
  }, [wl, pendingPairs]);

  const localPairs = pendingPairs ?? wl?.pairs ?? [];

  const savePairsMutation = useMutation({
    mutationFn: (pairs) => authFetch("/api/watchlist/pairs", { method: "PUT", body: JSON.stringify({ pairs }) }, getToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlist"] }); setDirty(false); },
  });

  const settingsMutation = useMutation({
    mutationFn: (settings) => authFetch("/api/watchlist/settings", { method: "PATCH", body: JSON.stringify(settings) }, getToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const togglePair = (symbol) => {
    if (localPairs.includes(symbol)) {
      setPendingPairs(localPairs.filter(p => p !== symbol));
    } else if (localPairs.length < 12) {
      setPendingPairs([...localPairs, symbol]);
    }
    setDirty(true);
  };

  const groups = [...new Set(ALL_SYMBOLS.map(s => s.group))];

  const scanEnabled = wl?.scanEnabled ?? false;
  const intervalMins = wl?.scanIntervalMinutes ?? 15;
  const sessionFilter = wl?.scanSessionFilter ?? "major";

  const nextScanIn = () => {
    if (!wl?.lastScannedAt) return null;
    const elapsed = Date.now() - new Date(wl.lastScannedAt).getTime();
    const remaining = intervalMins * 60_000 - elapsed;
    if (remaining <= 0) return "Soon";
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const [countdown, setCountdown] = useState(nextScanIn());
  useEffect(() => {
    if (!scanEnabled) return;
    const t = setInterval(() => setCountdown(nextScanIn()), 5000);
    return () => clearInterval(t);
  }, [wl, scanEnabled, intervalMins]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <ScanLine size={24} /> Auto-Scan Watchlist
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            GhostAgent monitors your pairs automatically — alerts on 72%+ confidence
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <Badge variant="outline" className="border-primary/50 text-primary text-[10px] gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="border-border/50 text-muted-foreground text-[10px]">OFFLINE</Badge>
          )}
        </div>
      </div>

      {/* Last signal flash */}
      {lastSignal?.source === "watchlist-scan" && (
        <div className={`border p-3 text-xs font-mono flex items-center gap-3 ${lastSignal.decision === "BUY" ? "border-green-500/40 bg-green-500/5 text-green-300" : "border-red-500/40 bg-red-500/5 text-red-300"}`}>
          <Radio size={14} className="animate-pulse shrink-0" />
          <span>
            <strong>SCAN ALERT</strong> — {lastSignal.decision} {lastSignal.symbol} · {lastSignal.confidence}% confidence · {lastSignal.confluenceScore}/8 confluence · R:R 1:{lastSignal.riskRewardRatio}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: pair selector */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/30 pb-3">
              <CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center justify-between">
                <span className="flex items-center gap-2"><Zap size={14} /> Pairs to Monitor</span>
                <span className="text-muted-foreground text-[10px] font-normal">{localPairs.length}/12 selected</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {groups.map(group => (
                <div key={group}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{group}</div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_SYMBOLS.filter(s => s.group === group).map(s => {
                      const active = localPairs.includes(s.value);
                      const atMax = localPairs.length >= 12 && !active;
                      return (
                        <button
                          key={s.value}
                          onClick={() => !atMax && togglePair(s.value)}
                          disabled={atMax}
                          className={`px-3 py-1.5 text-xs font-mono border transition-all duration-150 ${
                            active
                              ? "border-primary bg-primary/15 text-primary font-bold"
                              : atMax
                              ? "border-border/20 text-muted-foreground/30 cursor-not-allowed"
                              : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground cursor-pointer"
                          }`}
                        >
                          {active && <CheckCircle size={10} className="inline mr-1" />}
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {dirty && (
                <div className="flex gap-2 pt-2 border-t border-border/30">
                  <Button
                    className="flex-1 uppercase tracking-widest text-xs"
                    onClick={() => savePairsMutation.mutate(localPairs)}
                    disabled={savePairsMutation.isPending}
                  >
                    {savePairsMutation.isPending ? "Saving..." : `Save Watchlist (${localPairs.length} pairs)`}
                  </Button>
                  <Button variant="outline" className="text-xs uppercase" onClick={() => { setPendingPairs(wl?.pairs || []); setDirty(false); }}>
                    Discard
                  </Button>
                </div>
              )}

              {!dirty && localPairs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
                  {localPairs.map(sym => (
                    <div key={sym} className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 border border-primary/30 bg-primary/5 text-primary">
                      {sym}
                      <button className="ml-1 opacity-50 hover:opacity-100" onClick={() => { setPendingPairs(localPairs.filter(p => p !== sym)); setDirty(true); }}>
                        <X size={8} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {localPairs.length === 0 && !isLoading && (
                <div className="text-center py-6 text-muted-foreground/50 text-xs uppercase tracking-wider">
                  Select pairs above to start monitoring
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: scan settings */}
        <div className="space-y-4">
          {/* Master toggle */}
          <Card className={`border-border/50 bg-card/50 backdrop-blur transition-all ${scanEnabled ? "border-primary/30" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <Radio size={14} className={scanEnabled ? "text-primary animate-pulse" : "text-muted-foreground"} />
                    Auto-Scan
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {scanEnabled ? "Scanning your watchlist automatically" : "Enable to start background scanning"}
                  </div>
                </div>
                <button
                  onClick={() => settingsMutation.mutate({ scanEnabled: !scanEnabled })}
                  disabled={settingsMutation.isPending || localPairs.length === 0}
                  className="text-primary hover:text-primary/80 transition-colors disabled:opacity-30"
                >
                  {scanEnabled
                    ? <ToggleRight size={36} className="text-primary" />
                    : <ToggleLeft size={36} className="text-muted-foreground" />
                  }
                </button>
              </div>
              {localPairs.length === 0 && (
                <div className="text-[10px] text-yellow-500/80 flex items-center gap-1">
                  <AlertCircle size={10} /> Add pairs to your watchlist first
                </div>
              )}
              {scanEnabled && (
                <div className="text-[10px] text-muted-foreground space-y-0.5 border-t border-border/30 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Monitoring</span>
                    <span className="text-primary font-bold">{localPairs.length} pairs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interval</span>
                    <span className="text-foreground">{intervalMins} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sessions</span>
                    <span className="text-foreground">{SESSION_FILTERS.find(s => s.value === sessionFilter)?.label}</span>
                  </div>
                  {wl?.lastScannedAt && (
                    <div className="flex justify-between">
                      <span>Last scan</span>
                      <span className="text-foreground">{new Date(wl.lastScannedAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {countdown && (
                    <div className="flex justify-between">
                      <span>Next scan</span>
                      <span className="text-primary font-mono">{countdown}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Interval picker */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/30 pb-3">
              <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-primary">
                <Timer size={13} /> Scan Interval
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5">
              {INTERVALS.map(iv => (
                <button
                  key={iv.value}
                  onClick={() => settingsMutation.mutate({ scanIntervalMinutes: iv.value })}
                  className={`w-full text-left px-3 py-2 border transition-colors text-xs ${intervalMins === iv.value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  <div className="font-bold font-mono">{iv.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{iv.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Session filter */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/30 pb-3">
              <CardTitle className="text-xs uppercase tracking-widest flex items-center gap-2 text-primary">
                <Clock size={13} /> Trading Session
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5">
              {SESSION_FILTERS.map(sf => (
                <button
                  key={sf.value}
                  onClick={() => settingsMutation.mutate({ scanSessionFilter: sf.value })}
                  className={`w-full text-left px-3 py-2 border transition-colors text-xs ${sessionFilter === sf.value ? "border-primary bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  <div className="font-bold flex items-center gap-1.5">{sf.icon}{sf.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{sf.desc}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Notification status */}
          <Card className="border-border/50 bg-card/40 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    {permission === "granted" ? <Bell size={12} className="text-primary" /> : <BellOff size={12} className="text-muted-foreground" />}
                    Desktop Alerts
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {permission === "granted" ? "Enabled — signals pop up instantly" : "Click to enable browser notifications"}
                  </div>
                </div>
                {permission !== "granted" && (
                  <Button size="sm" variant="outline" className="text-[10px] uppercase tracking-wider" onClick={requestPermission}>
                    Enable
                  </Button>
                )}
                {permission === "granted" && (
                  <CheckCircle size={16} className="text-green-400" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cost info */}
          <div className="border border-border/30 bg-card/20 p-3 text-[10px] text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 text-primary/80 font-bold uppercase tracking-wider mb-2">
              <Info size={10} /> MetaAPI Cost Tips
            </div>
            <div>• One connection per scan cycle — closes immediately after</div>
            <div>• 15 min interval = ~96 connections/day per account</div>
            <div>• Scans skip quiet hours (00:00–05:00 UTC) and weekends</div>
            <div>• Duplicate signals are suppressed for 30 minutes</div>
            <div>• 5 min interval recommended only if MT5 is on a demo account</div>
          </div>
        </div>
      </div>
    </div>
  );
}
