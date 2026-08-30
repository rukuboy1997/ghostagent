import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { ArrowRight, Check, CircleAlert, Clock3, ExternalLink, KeyRound, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { authFetch } from "@/lib/authFetch";

const money = (value) => value == null ? "—" : `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Alpaca() {
  const { getToken } = useAuth();
  const status = useQuery({ queryKey: ["alpaca-status"], queryFn: () => authFetch("/api/alpaca/status", getToken), refetchInterval: 30000 });
  const account = useQuery({ queryKey: ["alpaca-account"], queryFn: () => authFetch("/api/alpaca/account", getToken), enabled: !!status.data?.connected, refetchInterval: 30000 });
  const clock = useQuery({ queryKey: ["alpaca-clock"], queryFn: () => authFetch("/api/alpaca/clock", getToken), refetchInterval: 60000 });
  const connected = status.data?.connected || status.data?.paper;
  const acct = account.data?.account || account.data;
  const marketOpen = clock.data?.is_open ?? clock.data?.isOpen;
  return (
    <div className="space-y-7">
      <PageIntro eyebrow="Broker connection" title="Alpaca paper account" description="The execution layer is intentionally boring: historical bars in, explainable options orders out." action={<Link href="/trading" className="inline-flex items-center gap-2 border border-primary bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:bg-primary/90" data-testid="link-trading">Review paper orders <ArrowRight size={14} /></Link>} />
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Connection" value={status.isLoading ? "Checking" : connected ? "Connected" : "Not configured"} detail={status.data?.paper ? "Paper environment" : "Awaiting API credentials"} tone={connected ? "good" : "warn"} />
        <Metric label="Market clock" value={clock.isLoading ? "Checking" : marketOpen ? "Open" : "Closed"} detail={clock.data?.next_open ? `Next open ${new Date(clock.data.next_open).toLocaleString()}` : "NYSE session"} tone={marketOpen ? "good" : "neutral"} />
        <Metric label="Account target" value="$100,000" detail="Hackathon starting-account target" tone="accent" />
      </div>
      {status.isError && <ErrorBox message="Alpaca status is unavailable. Check the API server and retry." onRetry={() => status.refetch()} />}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <section className="border border-border bg-card/80">
          <div className="flex items-start justify-between border-b border-border p-5">
            <div><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">Paper account snapshot</p><h2 className="mt-2 font-display text-2xl font-semibold">Capital with guardrails</h2></div>
            <WalletCards className="text-primary" size={20} />
          </div>
          {connected && acct ? (
            <div className="grid grid-cols-2 gap-px bg-border">
              {[
                ["Equity", money(acct.equity)], ["Cash", money(acct.cash)],
                ["Buying power", money(acct.buyingPower ?? acct.buying_power)], ["Status", acct.status || "—"],
                ["Options level", acct.optionsTradingLevel ?? acct.options_trading_level ?? "—"], ["Mode", acct.paper ? "PAPER" : "LIVE"],
              ].map(([label, value]) => <div key={label} className="bg-card p-5"><p className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-data text-lg text-foreground">{value}</p></div>)}
            </div>
          ) : <SetupState />}
        </section>
        <section className="border border-border bg-card/80 p-5">
          <p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">Setup checklist</p>
          <div className="mt-5 space-y-4">
            <Step done={!!connected} title="Connect Alpaca paper keys" copy="Use paper-api.alpaca.markets credentials." />
            <Step done={!!acct} title="Verify account permissions" copy="Options trading level and buying power are read-only here." />
            <Step done={!!marketOpen} title="Check the market clock" copy={marketOpen ? "NYSE session is currently open." : "Orders remain paper-only while the market is closed."} />
            <Step done={false} title="Choose underlyings" copy="Configure the autonomous scan universe." href="/watchlist" />
          </div>
          <div className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={15} className="mb-2 text-primary" /> GhostAgent never moves funds. It uses Alpaca only for paper-market data, paper options orders, and an auditable order trail.</div>
        </section>
      </div>
      <section className="terminal-grid border border-primary/20 bg-primary/[0.03] p-5">
        <div className="flex items-center gap-3"><KeyRound size={16} className="text-primary" /><p className="font-data text-xs uppercase tracking-wider text-primary">Credential note</p></div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">Paper trading is the default. Configure Alpaca credentials on the server, then return here to verify the connection. No account balance is invented when the broker is unavailable.</p>
      </section>
    </div>
  );
}

function PageIntro({ eyebrow, title, description, action }) {
  return <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end"><div><p className="font-data text-[10px] uppercase tracking-[.22em] text-primary">{eyebrow}</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</header>;
}
function Metric({ label, value, detail, tone }) { return <div className="border border-border bg-card/70 p-4"><p className="font-data text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className={`mt-3 font-display text-2xl ${tone === "good" ? "text-[hsl(174_56%_48%)]" : tone === "warn" ? "text-[hsl(28_80%_58%)]" : tone === "accent" ? "text-primary" : "text-foreground"}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }
function Step({ done, title, copy, href }) { const body = <div className="flex gap-3"><div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${done ? "border-[hsl(174_56%_48%)] bg-[hsl(174_56%_48%)]/10 text-[hsl(174_56%_48%)]" : "border-border text-muted-foreground"}`}>{done ? <Check size={12} /> : <span className="size-1.5 rounded-full bg-current" />}</div><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p></div>{href && <ArrowRight size={14} className="ml-auto mt-1 text-primary" />}</div>; return href ? <Link href={href} className="block border-b border-border/70 pb-4 last:border-0 hover:opacity-80" data-testid={`link-${title.toLowerCase().replaceAll(" ", "-")}`}>{body}</Link> : <div className="border-b border-border/70 pb-4 last:border-0">{body}</div>; }
function SetupState() { return <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center"><CircleAlert size={22} className="text-primary" /><p className="mt-3 text-sm font-semibold">Connect paper credentials to view account data</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">Account values will appear here from Alpaca. This demo does not fabricate equity or buying power.</p></div>; }
function ErrorBox({ message, onRetry }) { return <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><CircleAlert size={16} /><span className="flex-1">{message}</span><button onClick={onRetry} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline" data-testid="button-retry-alpaca"><RefreshCw size={13} /> Retry</button></div>; }