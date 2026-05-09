import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw,
  Server, Lock, User, ArrowRight, Info, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";

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

const POPULAR_BROKERS = [
  "ICMarkets-Live01", "ICMarkets-Demo01",
  "Exness-Real", "Exness-Trial",
  "FBS-Real", "FBS-Demo",
  "XM.COM-Real 3", "XM.COM-Demo",
  "Pepperstone-Live01", "Pepperstone-Demo01",
  "FTMO-Server", "FTMO-Demo",
  "Fusion Markets-Live", "Fusion Markets-Demo",
  "OctaFX-Real", "OctaFX-Demo",
  "HotForex-Live04", "HotForex-Demo04",
];

export default function ConnectMT5() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ mt5Login: "", mt5Password: "", mt5Server: "" });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [pollingCount, setPollingCount] = useState(0);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["mt5-status"],
    queryFn: () => authGet("/api/mt5/status", getToken),
    refetchInterval: (query) => query.state.data?.state === "DEPLOYING" ? 5000 : false,
  });

  const connectMutation = useMutation({
    mutationFn: () => authPost("/api/mt5/connect", form, getToken),
    onSuccess: (data) => {
      setSuccess(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ["mt5-status"] });
      qc.invalidateQueries({ queryKey: ["trading-status"] });
      qc.invalidateQueries({ queryKey: ["signal-status"] });
    },
    onError: (err) => {
      setError(err.data?.error || err.message || "Failed to connect MT5 account");
    },
  });

  const isConnected = status?.connected;
  const isDeploying = status?.state === "DEPLOYING" || success?.state === "DEPLOYING";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Server size={24} /> Connect MT5
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
            Link your MetaTrader 5 broker account
          </p>
        </div>
        {isConnected && (
          <Badge variant="outline" className="border-green-500/50 text-green-400 uppercase text-xs tracking-wider px-3 py-1">
            <Wifi size={12} className="mr-1" /> Connected
          </Badge>
        )}
      </div>

      <div className="border border-primary/20 bg-primary/5 p-4 space-y-2">
        <div className="text-xs text-primary uppercase tracking-wider flex items-center gap-2 font-bold">
          <Shield size={12} /> Security Notice
        </div>
        <p className="text-xs text-foreground/70 leading-relaxed">
          GhostAgent only uses your MT5 credentials to read market data and optionally execute trades on your behalf when you enable Auto-Trade mode.
          <strong className="text-foreground"> Your broker funds are never accessible to GhostAgent</strong> — we have no way to withdraw money from your account.
          All trading happens directly on your broker account.
        </p>
      </div>

      {isConnected && (
        <div className="border border-green-500/30 bg-green-500/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle size={18} className="text-green-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-green-300">MT5 Account Connected</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Login: {status?.login} · Server: {status?.server}
              </div>
            </div>
            <Badge
              variant="outline"
              className={`ml-auto text-[10px] uppercase ${status?.connectionStatus === "CONNECTED" ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}`}
            >
              {status?.connectionStatus || status?.state}
            </Badge>
          </div>
          {status?.demo && (
            <div className="text-[10px] text-yellow-400/70 flex items-center gap-1">
              <Info size={10} /> Demo mode — configure METAAPI_TOKEN for live connection
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Link href="/trading">
              <Button size="sm" className="uppercase text-xs tracking-wider">
                <ArrowRight size={12} className="mr-1" /> Go to Auto-Trade
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchStatus()}
              className="uppercase text-xs tracking-wider"
            >
              <RefreshCw size={12} className="mr-1" /> Refresh Status
            </Button>
          </div>
        </div>
      )}

      {isDeploying && !isConnected && (
        <div className="border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <RefreshCw size={16} className="text-primary animate-spin shrink-0" />
          <div>
            <div className="text-sm font-bold text-primary">Connecting to your MT5 account...</div>
            <div className="text-xs text-muted-foreground mt-0.5">This can take 1-3 minutes. The page will update automatically.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <Server size={16} /> MT5 Account Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <User size={10} /> MT5 Login Number
              </label>
              <Input
                type="text"
                placeholder="e.g. 123456789"
                value={form.mt5Login}
                onChange={(e) => setForm({ ...form, mt5Login: e.target.value })}
                className="bg-background/50 border-border/50 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Lock size={10} /> MT5 Password
              </label>
              <Input
                type="password"
                placeholder="Your MT5 investor/trading password"
                value={form.mt5Password}
                onChange={(e) => setForm({ ...form, mt5Password: e.target.value })}
                className="bg-background/50 border-border/50 text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use your trading password (not investor-read-only) for auto-trade mode.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block flex items-center gap-1">
                <Server size={10} /> Broker Server
              </label>
              <Input
                type="text"
                placeholder="e.g. ICMarkets-Live01"
                value={form.mt5Server}
                onChange={(e) => setForm({ ...form, mt5Server: e.target.value })}
                className="bg-background/50 border-border/50 text-sm font-mono"
                list="broker-servers"
              />
              <datalist id="broker-servers">
                {POPULAR_BROKERS.map((b) => <option key={b} value={b} />)}
              </datalist>
              <p className="text-[10px] text-muted-foreground mt-1">
                Found in MT5 → File → Open Account → Server name
              </p>
            </div>

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {success && (
              <div className="border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300 flex items-start gap-2">
                <CheckCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Connection initiated!</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Account ID: {success.accountId}</div>
                </div>
              </div>
            )}

            <Button
              className="w-full uppercase tracking-widest text-xs"
              onClick={() => connectMutation.mutate()}
              disabled={!form.mt5Login || !form.mt5Password || !form.mt5Server || connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <><RefreshCw size={14} className="mr-2 animate-spin" /> Connecting...</>
              ) : (
                <><Wifi size={14} className="mr-2" /> Connect MT5 Account</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Info size={16} /> How to Find Your Server Name
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs text-foreground/80 leading-relaxed">
              <p>1. Open MetaTrader 5 on your computer</p>
              <p>2. Go to <strong>File → Open Account</strong></p>
              <p>3. Search for your broker name</p>
              <p>4. The server name appears in the list (e.g. "ICMarkets-Live01")</p>
              <p className="text-muted-foreground">Or check your broker welcome email — it usually contains the server name.</p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Wifi size={16} /> Popular Broker Servers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                {["ICMarkets-Live01", "Exness-Real", "Pepperstone-Live01", "XM.COM-Real 3", "FTMO-Server", "FBS-Real", "HotForex-Live04"].map((b) => (
                  <button
                    key={b}
                    className="text-[10px] border border-border/50 px-2 py-1 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    onClick={() => setForm({ ...form, mt5Server: b })}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
                <Shield size={16} /> What GhostAgent Can Do
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={10} /> Read live market prices
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={10} /> Analyze your account balance & equity
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={10} /> Place/close trades (Auto-Trade mode only)
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle size={10} /> View open positions
              </div>
              <div className="flex items-center gap-2 text-red-400/70 mt-2">
                <WifiOff size={10} /> Cannot withdraw funds
              </div>
              <div className="flex items-center gap-2 text-red-400/70">
                <WifiOff size={10} /> Cannot deposit or transfer money
              </div>
              <div className="flex items-center gap-2 text-red-400/70">
                <WifiOff size={10} /> Cannot access personal data
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
