import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { DollarSign, CreditCard, History, AlertCircle, CheckCircle, RefreshCw, Ghost } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/api";
import { useFlutterwave, closePaymentModal } from "flutterwave-react-v3";

const FLW_PUBLIC_KEY = "FLWPUBK-878fa54677d7b3dc8a6d40e1ae90ca64-X";

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
    tx_ref: `ghost-${Date.now()}`,
    amount: 10,
    currency: "USD",
    payment_options: "card,ussd,account",
    customer: {
      email: user?.primaryEmailAddress?.emailAddress || "user@example.com",
      name: user?.fullName || "GhostAgent User",
    },
    customizations: {
      title: "GhostAgent Deposit",
      description: "Fund your GhostAgent trading account",
      logo: "",
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  return (
    <Button
      onClick={() =>
        handleFlutterPayment({
          callback: (response) => {
            closePaymentModal();
            onSuccess(response);
          },
          onClose: () => {},
        })
      }
      className="w-full uppercase tracking-widest text-xs"
    >
      <CreditCard size={14} className="mr-1" /> Pay via Flutterwave ($10)
    </Button>
  );
}

function ShareButton({ user, shareAmount, onSuccess }) {
  const config = {
    public_key: FLW_PUBLIC_KEY,
    tx_ref: `ghost-share-${Date.now()}`,
    amount: Math.max(Number(shareAmount) || 1, 1),
    currency: "USD",
    payment_options: "card,ussd,account",
    customer: {
      email: user?.primaryEmailAddress?.emailAddress || "user@example.com",
      name: user?.fullName || "GhostAgent User",
    },
    customizations: {
      title: "GhostAgent Share Payment",
      description: "Pay GhostAgent's 30% profit share to continue trading",
      logo: "",
    },
  };

  const handleFlutterPayment = useFlutterwave(config);

  return (
    <Button
      variant="outline"
      className="w-full uppercase tracking-widest text-xs border-primary/50 text-primary hover:bg-primary/10"
      onClick={() =>
        handleFlutterPayment({
          callback: (response) => {
            closePaymentModal();
            onSuccess(response, "share");
          },
          onClose: () => {},
        })
      }
    >
      <Ghost size={14} className="mr-1" /> Pay GhostAgent Share
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
    queryKey: ["trading-status"],
    queryFn: () => authGet("/api/trading/status", getToken),
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
          ? "GhostAgent share paid! You can now continue trading."
          : `Deposit confirmed! +$${Number(data.amountUsd).toFixed(2)} added to your balance.`
      );
      setPaymentError(null);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["trading-status"] });
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

  const ghostShareOwed = status?.shareRequired
    ? Number(me?.user?.totalProfit ?? 0) * 0.30
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <DollarSign size={24} /> Account
        </h2>
        <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">
          Manage your balance and payments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-primary">
              ${Number(me?.user?.balance ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{me?.user?.currency || "USD"}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold font-mono ${Number(me?.user?.totalProfit) >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${Number(me?.user?.totalProfit ?? 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Your 70% share</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-foreground">
              {status?.totalTrades ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {status?.tradesUntilShare ?? 3} until next share
            </div>
          </CardContent>
        </Card>
      </div>

      {paymentMsg && (
        <div className="border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-3 text-green-300">
          <CheckCircle size={16} />
          {paymentMsg}
        </div>
      )}
      {paymentError && (
        <div className="border border-red-500/30 bg-red-500/5 p-4 flex items-center gap-3 text-red-300">
          <AlertCircle size={16} />
          {paymentError}
        </div>
      )}
      {verifyMutation.isPending && (
        <div className="border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 text-primary">
          <RefreshCw size={16} className="animate-spin" />
          Verifying payment...
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-primary">
              <CreditCard size={16} /> Deposit Funds
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              Deposit a minimum of <span className="text-primary font-bold">$5</span> to start trading. Funds are credited instantly after payment.
            </div>
            <div className="border border-border/30 bg-background/30 p-3 space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="text-primary font-mono font-bold">${Number(me?.user?.balance ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs uppercase tracking-wider">
                <span className="text-muted-foreground">Min Required</span>
                <span className="text-foreground font-mono">$5.00</span>
              </div>
            </div>
            {user ? (
              <DepositButton user={user} onSuccess={handlePaymentSuccess} />
            ) : (
              <Button disabled className="w-full uppercase tracking-widest text-xs">Sign in to deposit</Button>
            )}
            <p className="text-[10px] text-muted-foreground/70 text-center">
              Payments secured by Flutterwave · NGN, USD, GBP and more accepted
            </p>
          </CardContent>
        </Card>

        {status?.shareRequired && (
          <Card className="border-red-500/30 bg-red-500/5 backdrop-blur">
            <CardHeader className="border-b border-red-500/20 pb-4">
              <CardTitle className="uppercase tracking-widest text-sm flex items-center gap-2 text-red-400">
                <Ghost size={16} /> GhostAgent Share Due
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="text-sm text-red-300">
                You've completed <strong>{status.tradesSinceLastShare}</strong> trades. GhostAgent's 30% share is now due.
              </div>
              <div className="border border-red-500/20 bg-background/30 p-3 space-y-2">
                <div className="flex justify-between text-xs uppercase tracking-wider">
                  <span className="text-muted-foreground">Your Total Profit</span>
                  <span className="text-green-400 font-mono">${Number(me?.user?.totalProfit ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs uppercase tracking-wider">
                  <span className="text-muted-foreground">GhostAgent 30%</span>
                  <span className="text-red-400 font-mono font-bold">${Math.max(ghostShareOwed, 1).toFixed(2)}</span>
                </div>
              </div>
              {user ? (
                <ShareButton user={user} shareAmount={Math.max(ghostShareOwed, 1)} onSuccess={(r) => handlePaymentSuccess(r, "share")} />
              ) : null}
              <p className="text-[10px] text-muted-foreground/70">
                Pay GhostAgent's 30% to unlock your next 3 trades.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

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
                      {item.type === "ghost_share" ? "GhostAgent Share" : "Deposit"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()} · {item.currency}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${item.type === "ghost_share" ? "text-red-400" : "text-green-400"}`}>
                      {item.type === "ghost_share" ? "-" : "+"}${Number(item.amountUsd || item.amount).toFixed(2)}
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
