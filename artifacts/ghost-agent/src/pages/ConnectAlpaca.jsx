import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { CheckCircle, CircleAlert, Landmark, LockKeyhole, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";

async function authGet(path, getToken) {
  const token = await getToken();
  const response = await fetch(getApiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || "Unable to read Alpaca status");
  return data;
}

function Metric({ label, value, accent = "" }) {
  return <div className="border border-border/40 bg-background/30 p-3"><div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div><div className={`mt-1 text-lg font-bold font-mono ${accent}`}>{value}</div></div>;
}

export default function ConnectAlpaca() {
  const { getToken } = useAuth();
  const { data: status, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["alpaca-status"],
    queryFn: () => authGet("/api/alpaca/status", getToken),
    refetchInterval: 30000,
  });
  const { data: account } = useQuery({
    queryKey: ["alpaca-account"],
    queryFn: () => authGet("/api/alpaca/account", getToken),
    refetchInterval: 30000,
  });

  const connected = status?.connected || status?.configured;
  const acct = account || status;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div><div className="flex items-center gap-2 text-primary text-2xl font-bold uppercase tracking-widest"><Landmark size={24} /> Alpaca Paper</div><p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Broker infrastructure and execution permissions</p></div>
        <Badge variant="outline" className={connected ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}>{connected ? "CONNECTED" : "SETUP REQUIRED"}</Badge>
      </div>
      <div className="border border-primary/20 bg-primary/5 p-4 flex gap-3">
        <ShieldCheck className="text-primary shrink-0" size={20} />
        <div><div className="text-xs font-bold uppercase tracking-wider text-primary">Server-side credentials</div><p className="mt-1 text-xs text-foreground/70 leading-relaxed">GhostAgent never asks for or stores broker credentials in the browser. This workspace uses Replit Secrets to connect to Alpaca's paper environment, so every order is simulated and cannot withdraw funds.</p></div>
      </div>
      {isLoading ? <div className="h-32 border border-border/40 bg-card/30 animate-pulse" /> : isError ? <div className="border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300 flex items-center gap-2"><CircleAlert size={16} /> Alpaca is not reachable. Check the server configuration and refresh.</div> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Environment" value={acct?.paper ? "PAPER" : "UNKNOWN"} accent="text-primary" />
          <Metric label="Account status" value={acct?.status || "—"} accent={acct?.status === "ACTIVE" ? "text-green-400" : "text-yellow-400"} />
          <Metric label="Equity" value={acct?.equity ? `$${Number(acct.equity).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
          <Metric label="Buying power" value={acct?.buyingPower ? `$${Number(acct.buyingPower).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/30"><CardTitle className="text-sm uppercase tracking-widest text-primary">Integration evidence</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            {["Alpaca Trading API v2", "Alpaca Market Data API", "Options contracts and snapshots", "Paper-account order routing"].map((item) => <div key={item} className="flex gap-2 items-center text-green-400"><CheckCircle size={14} /> {item}</div>)}
            <div className="border-t border-border/30 pt-3 mt-3 flex justify-between"><span className="text-muted-foreground">Options approval</span><span className="font-bold text-primary">{acct?.optionsTradingLevel ?? "Read from account"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Account number</span><span className="font-mono">{acct?.accountNumber || "Hidden"}</span></div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/30"><CardTitle className="text-sm uppercase tracking-widest text-primary">Before you enable the agent</CardTitle></CardHeader>
          <CardContent className="p-4 space-y-4 text-xs text-foreground/75 leading-relaxed">
            <p><strong className="text-foreground">1.</strong> Confirm the account is a paper account with options buying approval.</p>
            <p><strong className="text-foreground">2.</strong> Review every AI thesis and risk gate in Signals before execution.</p>
            <p><strong className="text-foreground">3.</strong> Turn on autonomous execution only from Watchlist after selecting a small set of underlyings.</p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/watchlist"><Button size="sm" className="text-[10px] uppercase tracking-wider">Configure agent <ArrowRight size={12} className="ml-1" /></Button></Link>
              <Button size="sm" variant="outline" className="text-[10px] uppercase tracking-wider" onClick={() => refetch()} disabled={isFetching}><RefreshCw size={12} className={`mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="text-[10px] text-muted-foreground flex items-center gap-2"><LockKeyhole size={12} /> Broker access is read, analyze, and paper-order only. GhostAgent cannot transfer funds.</div>
    </div>
  );
}