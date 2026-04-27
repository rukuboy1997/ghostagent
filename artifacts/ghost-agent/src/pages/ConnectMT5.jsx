import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Plug, CheckCircle, AlertCircle, RefreshCw, Server, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const COMMON_SERVERS = [
  "Deriv-Demo",
  "Deriv-Server",
  "Deriv-Server 2",
  "ICMarkets-Demo",
  "ICMarkets-Live01",
  "ICMarkets-Live02",
  "Exness-Real",
  "Exness-Trial",
  "MetaQuotes-Demo",
  "XM.COM-Demo 3",
  "FxPro-Demo Server",
  "Pepperstone-Demo01",
];

export default function ConnectMT5() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ mt5Login: "", mt5Password: "", mt5Server: "" });
  // Pre-fill from existing account once loaded
  const [prefilled, setPrefilled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => authGet("/api/auth/me", getToken),
    onSuccess: (data) => {
      if (!prefilled && data?.user?.mt5Login) {
        setForm((f) => ({
          ...f,
          mt5Login: data.user.mt5Login || "",
          mt5Server: data.user.mt5Server || "",
        }));
        setPrefilled(true);
      }
    },
  });

  const { data: accountInfo, refetch: refetchAccount } = useQuery({
    queryKey: ["mt5-account"],
    queryFn: () => authGet("/api/mt5/account", getToken),
    enabled: !!me?.user?.mt5AccountId,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: () => authPost("/api/mt5/connect", form, getToken),
    onSuccess: (data) => {
      setSuccess(data);
      setError(null);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["mt5-account"] });
      qc.invalidateQueries({ queryKey: ["trading-status"] });
    },
    onError: (err) => {
      setError(err.message || "Connection failed");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!form.mt5Login || !form.mt5Password || !form.mt5Server) {
      setError("All fields are required");
      return;
    }
    connectMutation.mutate();
  };

  const alreadyConnected = !!me?.user?.mt5AccountId;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <Plug size={24} /> Connect MT5
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
          Link your broker's MetaTrader 5 account
        </p>
      </div>

      {me?.user?.mt5AccountId?.startsWith("demo-") && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-300">
            <div className="font-bold mb-1">Action required — re-enter your MT5 password</div>
            Your account was saved in demo mode before MetaAPI was activated. Your login (<span className="font-mono text-yellow-200">{me.user.mt5Login}</span>) and server (<span className="font-mono text-yellow-200">{me.user.mt5Server}</span>) are pre-filled below — just enter your password and click Connect to go live.
          </div>
        </div>
      )}

      {alreadyConnected && accountInfo && !me?.user?.mt5AccountId?.startsWith("demo-") && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="border-b border-green-500/20 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-green-400">
              <CheckCircle size={16} /> MT5 Connected
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm font-mono">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Login</div>
                <div className="text-foreground">{me.user.mt5Login}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Server</div>
                <div className="text-foreground">{me.user.mt5Server}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Balance</div>
                <div className="text-green-400">${Number(accountInfo.balance ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Equity</div>
                <div className="text-primary">${Number(accountInfo.equity ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Currency</div>
                <div className="text-foreground">{accountInfo.currency}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Leverage</div>
                <div className="text-foreground">1:{accountInfo.leverage}</div>
              </div>
            </div>
            {accountInfo.demo && (
              <div className="text-[10px] text-yellow-400/70 mt-2 uppercase tracking-wider">DEMO MODE — MetaAPI not configured</div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="uppercase tracking-widest text-xs mt-2"
              onClick={() => refetchAccount()}
            >
              <RefreshCw size={13} className="mr-1" /> Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
            <Server size={16} /> {alreadyConnected ? "Update MT5 Account" : "Add MT5 Account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                MT5 Login (Account Number)
              </Label>
              <Input
                placeholder="e.g. 12345678"
                value={form.mt5Login}
                onChange={(e) => setForm((f) => ({ ...f, mt5Login: e.target.value }))}
                className="border-border/50 bg-background/50 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                MT5 Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your MT5 password"
                  value={form.mt5Password}
                  onChange={(e) => setForm((f) => ({ ...f, mt5Password: e.target.value }))}
                  className="border-border/50 bg-background/50 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                MT5 Server
              </Label>
              <Input
                list="mt5-servers"
                placeholder="e.g. ICMarkets-Demo"
                value={form.mt5Server}
                onChange={(e) => setForm((f) => ({ ...f, mt5Server: e.target.value }))}
                className="border-border/50 bg-background/50 font-mono"
              />
              <datalist id="mt5-servers">
                {COMMON_SERVERS.map((s) => <option key={s} value={s} />)}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">
                Find your server name in your broker's MT5 settings
              </p>
            </div>

            {error && (
              <div className="border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {success && (
              <div className="border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300 flex items-center gap-2">
                <CheckCircle size={14} />
                MT5 account connected! {success.demo && "(Demo mode)"}
              </div>
            )}

            <Button
              type="submit"
              className="w-full uppercase tracking-widest text-xs"
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <><RefreshCw size={14} className="mr-1 animate-spin" /> Connecting...</>
              ) : (
                <><Plug size={14} className="mr-1" /> {alreadyConnected ? "Update Connection" : "Connect MT5"}</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[
            { step: "1", text: "Open your MT5 platform and find your account login number, password, and server name." },
            { step: "2", text: "Enter your credentials above. GhostAgent connects via MetaAPI cloud — no need to keep MT5 open." },
            { step: "3", text: "Once connected, GhostAgent's AI will analyze markets and can place trades autonomously on your behalf." },
            { step: "4", text: "After 3 trades, pay GhostAgent's 30% share to continue. You keep 70% of all profits." },
          ].map(({ step, text }) => (
            <div key={step} className="flex gap-3 text-sm">
              <span className="text-primary font-bold font-mono shrink-0">{step}.</span>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
