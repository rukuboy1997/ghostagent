import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { Link } from "wouter";
import {
  DollarSign, CreditCard, History, AlertCircle, CheckCircle,
  RefreshCw, Ghost, Radio, Server, Wifi, Lock, User, ArrowRight,
  Shield, Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";

const FLW_PUBLIC_KEY = "FLWPUBK-e1e2e1869c85b597b394de8bb2eddf88-X";
const FLW_CURRENCY = "USD";
const FLW_MIN_AMOUNT = 10;

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

function DepositButton({ user, onSuccess }) {
  const config = {
    public_key: FLW_PUBLIC_KEY,
    tx_ref: `ghost-dep-${Date.now()}`,
    amount: FLW_MIN_AMOUNT,
    currency: FLW_CURRENCY,
    payment_options: "card,banktransfer,ussd,account",
    customer: {
      email: user?.primaryEmailAddress?.emailAddress || "user@example.com",
      name: user?.fullName || "GhostAgent User",
    },
    customizations: {
      title: "GhostAgent Deposit",
      description: "Fund your GhostAgent account ($10 minimum)",
      logo: "",
    },
  };
  const handleFlutterPayment = useFlutterwave(config);
  return (
    <Button
      onClick={() => handleFlutterPayment({ callback: (response) => { closePaymentModal(); onSuccess(response); }, onClose: () => {} })}
      className="w-full uppercase tracking-widest text-xs"
    >
      <CreditCard size={14} className="mr-1" /> Deposit $10 via Flutterwave
    </Button>
  );
}

function ShareButton({ user, onSuccess }) {
  const config = {
    public_key: FLW_PUBLIC_KEY,
    tx_ref: `ghost-share-${Date.now()}`,
    amount: 10,
    currency: FLW_CURRENCY,
    payment_options: "card,banktransfer,ussd,account",
    customer: {
      email: user?.primaryEmailAddress?.emailAddress || "user@example.com",
      name: user?.fullName || "GhostAgent User",
    },
    customizations: {
      title: "GhostAgent 20% Share",
      description: "Send GhostAgent's 20% share after 3 profitable signals",
      logo: "",
    },
  };
  const handleFlutterPayment = useFlutterwave(config);
  return (
    <Button
      variant="outline"
      className="w-full uppercase tracking-widest text-xs border-primary/50 text-primary hover:bg-primary/10"
      onClick={() => handleFlutterPayment({ callback: (response) => { closePaymentModal(); onSuccess(response, "share"); }, onClose: () => {} })}
    >
      <Ghost size={14} className="mr-1" /> Send GhostAgent 20% Share
    </Button>
  );
}

export default function Account() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const qc = useQueryClient();
  const [paymentMsg, setPaymentMsg] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => authGet("/api/auth/me", getToken),
  });

  const { data: status } = useQuery({
    queryKey: ["signal-status"],
    queryFn: () => authGet("/api/signals/status", getToken),
    refetchInterval: 30000,
  });

  const { data: mt5Status } = useQuery({
    queryKey: ["mt5-status"],
    queryFn: () => authGet("/api/mt5/status", getToken),
    refetchInterval: 30000,
  });

  const { data: paymentHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["payment-history"],
    queryFn: () => authGet("/api/payments/history", getToken),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ txRef, txId, amount, currency, flutterwaveStatus, type }) => {
      const endpoint = type === "share" ? "/api/payments/verify-share" : "/api/payments/verify-deposit";
      return authPost(endpoint, { txRef, txId, amount, currency, flutterwaveStatus }, getToken);
    },
    onSuccess: (data, vars) => {
      const isShare = vars.type === "share";
      setPaymentMsg(
        isShare
          ? "GhostAgent share sent! Signals and trading are now unlocked."
          : `Deposit confirmed! +$${Number(data.amountUsd).toFixed(2)} added to your GhostAgent balance.`
      );
      setPaymentError(null);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["signal-status"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
    },
    onError: (err) => {
      setPaymentError(err.message || "Payment verification failed");
    },
  });

  const handlePaymentSuccess = (response, type = "deposit") => {
    setPaymentMsg(null);
    setPaymentError(null);
    verifyMutation.mutate({
      txRef: response.tx_ref,
      txId: String(response.transaction_id),
      amount: response.amount,
      currency: response.currency,
      flutterwaveStatus: response.status,
      type,
    });
  };

  const balance = Number(me?.user?.balance ?? 0);
  const hasMinBalance = balance >= 10;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <User size={24} /> Account
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
          Manage your balance, MT5 connection &amp; share payments
        </p>
      </div>

      {!hasMinBalance && (
        <div className="border border-orange-500/30 bg-orange-500/5 p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">
            You need a minimum <strong>$10 GhostAgent balance</strong> to receive signals or enable auto-trading.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 bg-card/50 col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Ghost Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-mono ${hasMinBalance ? "text-primary" : "text-orange-400"}`}>
              ${balance.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{me?.user?.currency || "USD"} · {hasMinBalance ? "Active" : "Min $10 required"}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-foreground">{status?.totalTrades ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Radio size={10} /> AI-generated
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/50 bg-card/50 ${status?.shareRequired ? "border-red-500/50 bg-red-500/5" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">TP Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-mono ${status?.shareRequired ? "text-red-400" : "text-foreground"}`}>
              {status?.tpSignalsSinceLastShare ?? 0}/3
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {status?.shareRequired ? "Share required!" : `${status?.tpUntilShare ?? 3} TP hits until share`}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/50 bg-card/50 ${mt5Status?.connected ? "border-green-500/20" : "border-yellow-500/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">MT5 Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-sm font-bold font-mono uppercase ${mt5Status?.connected ? "text-green-400" : "text-yellow-400"}`}>
              {mt5Status?.connected ? "Connected" : "Not Connected"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {mt5Status?.connected ? (status?.mt5Login || "Active") : "Connect for auto-trade"}
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentMsg && (
        <div className="border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3 text-green-300">
          <CheckCircle size={16} />{paymentMsg}
        </div>
      )}
      {paymentError && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3 text-red-300">
          <AlertCircle size={16} />{paymentError}
        </div>
      )}
      {verifyMutation.isPending && (
        <div className="border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 text-primary">
          <RefreshCw size={16} className="animate-spin" /> Verifying payment...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <CreditCard size={16} /> Deposit to GhostAgent
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              Deposit a minimum of <span className="text-primary font-bold">$10</span> to activate signal access and trading.
              This balance stays in GhostAgent — your actual trading money stays in your MT5 broker account.
            </div>
            <div className="border border-border/30 bg-background/30 p-3 space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Current Balance</span>
                <span className={`font-mono font-bold ${hasMinBalance ? "text-primary" : "text-orange-400"}`}>${balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Minimum Required</span>
                <span className="text-foreground font-mono">$10.00</span>
              </div>
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-mono font-bold ${hasMinBalance ? "text-green-400" : "text-red-400"}`}>
                  {hasMinBalance ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>
            {user ? (
              <DepositButton user={user} onSuccess={handlePaymentSuccess} />
            ) : (
              <Button disabled className="w-full uppercase tracking-widest text-xs">Sign in to deposit</Button>
            )}
            <p className="text-[10px] text-muted-foreground/70 text-center">
              Secured by Flutterwave · Card, Bank Transfer &amp; USSD accepted
            </p>
          </CardContent>
        </Card>

        <Card className={`backdrop-blur ${status?.shareRequired ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card/50"}`}>
          <CardHeader className={`border-b pb-4 ${status?.shareRequired ? "border-red-500/20" : "border-border/50"}`}>
            <CardTitle className={`uppercase tracking-widest text-sm flex items-center gap-2 ${status?.shareRequired ? "text-red-400" : "text-primary"}`}>
              <Ghost size={16} /> GhostAgent 20% Share
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {status?.shareRequired ? (
              <>
                <div className="text-sm text-red-300">
                  <strong>3 signals hit Take Profit!</strong> Send GhostAgent's 20% share to unlock more signals and trading.
                </div>
                <div className="border border-red-500/20 bg-background/30 p-3 space-y-2 text-xs">
                  <p className="text-muted-foreground leading-relaxed">
                    The 20% Ghost Share is sent after every 3 TP signals. Your 80% profit is yours — it stays in your broker account.
                    GhostAgent only tracks signal performance, not your actual profits. Send a fair amount based on what you earned.
                  </p>
                </div>
                {user ? <ShareButton user={user} onSuccess={(r) => handlePaymentSuccess(r, "share")} /> : null}
              </>
            ) : (
              <>
                <div className="text-sm text-muted-foreground">
                  After every 3 signals hit Take Profit, send GhostAgent's 20% share to continue.
                  Your 80% profit stays in your broker account.
                </div>
                <div className="border border-border/30 bg-background/30 p-3 space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider">
                    <span className="text-muted-foreground">TP Signals So Far</span>
                    <span className="text-primary font-mono font-bold">{status?.tpSignalsSinceLastShare ?? 0}/3</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-wider">
                    <span className="text-muted-foreground">Until Share Required</span>
                    <span className="text-foreground font-mono">{status?.tpUntilShare ?? 3} more TP hits</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-wider">
                    <span className="text-muted-foreground">Your Share</span>
                    <span className="text-green-400 font-mono font-bold">80%</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-wider">
                    <span className="text-muted-foreground">GhostAgent Share</span>
                    <span className="text-primary font-mono font-bold">20%</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <Info size={9} /> Keep trading — share only required after 3 signals hit TP.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={`border-border/50 ${mt5Status?.connected ? "bg-card/50" : "border-yellow-500/20 bg-yellow-500/5"} backdrop-blur`}>
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
            <Server size={16} /> MT5 Account Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {mt5Status?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <div className="text-sm font-bold text-green-300">Connected to MT5</div>
                  <div className="text-xs text-muted-foreground">
                    Login: {status?.mt5Login || "—"} · Server: {status?.mt5Server || "—"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className={`text-[10px] uppercase ${mt5Status.connectionStatus === "CONNECTED" ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}`}>
                  {mt5Status.connectionStatus || mt5Status.state}
                </Badge>
                <Link href="/connect-mt5">
                  <Button size="sm" variant="outline" className="text-xs uppercase tracking-wider">
                    Manage
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-yellow-300 mb-1">No MT5 Account Connected</div>
                <div className="text-xs text-muted-foreground">
                  Connect your broker MT5 account to enable auto-trading and live market analysis.
                </div>
              </div>
              <Link href="/connect-mt5">
                <Button size="sm" className="uppercase text-xs tracking-wider ml-4">
                  <Server size={12} className="mr-1" /> Connect MT5 <ArrowRight size={12} className="ml-1" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
            <History size={16} /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted/50 animate-pulse border border-border/50" />)}
            </div>
          ) : !paymentHistory?.length ? (
            <div className="text-center p-8 text-muted-foreground font-mono text-sm">
              NO PAYMENT HISTORY
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {paymentHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                  <div>
                    <div className="text-sm font-mono font-bold">
                      {item.type === "ghost_share" ? "GhostAgent 20% Share" : "Account Deposit"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()} · {item.currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${item.type === "ghost_share" ? "text-primary" : "text-green-400"}`}>
                      {item.type === "ghost_share" ? "" : "+"}${Number(item.amountUsd || item.amount).toFixed(2)}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${item.status === "completed" ? "border-green-500/50 text-green-400" : "border-yellow-500/50 text-yellow-400"}`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
