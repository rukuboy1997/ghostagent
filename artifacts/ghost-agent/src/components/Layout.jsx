import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Radio, User, Menu, X, Ghost, Zap, Wifi, BookOpen, Bell, BellOff, ScanLine, Landmark } from "lucide-react";
import { useAuth, UserButton, SignInButton } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import { useNotifications } from "@/components/NotificationProvider";

function Layout({ children }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isSignedIn, isLoaded } = useAuth();
  const { permission, connected, lastSignal, requestPermission } = useNotifications();
  const [signalFlash, setSignalFlash] = useState(false);
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetch(getApiUrl("/api/healthz")).then((r) => r.json()),
    refetchInterval: 30000,
  });
  const isHealthy = health?.status === "ok" || health?.status === "healthy";

  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  useEffect(() => { setMobileMenuOpen(false); }, [location]);
  useEffect(() => {
    if (!lastSignal) return;
    setSignalFlash(true);
    const timer = setTimeout(() => setSignalFlash(false), 6000);
    return () => clearTimeout(timer);
  }, [lastSignal]);

  const navLinks = [
    { href: "/", icon: <LayoutDashboard size={15} />, label: "Dashboard", active: location === "/" },
    { href: "/signals", icon: <Radio size={15} />, label: "Signals", active: location === "/signals" },
    { href: "/trading", icon: <Zap size={15} />, label: "Execute", active: location === "/trading" },
    { href: "/alpaca", icon: <Landmark size={15} />, label: "Alpaca", active: location === "/alpaca" },
    { href: "/watchlist", icon: <ScanLine size={15} />, label: "Watchlist", active: location === "/watchlist" },
    { href: "/journal", icon: <BookOpen size={15} />, label: "Journal", active: location === "/journal" },
    { href: "/account", icon: <User size={15} />, label: "Account", active: location === "/account" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col relative overflow-hidden">
      <div className="scanlines" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />
      {signalFlash && lastSignal && (
        <div className={`sticky top-0 z-50 px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-3 ${lastSignal.decision === "BUY_CALL" ? "bg-green-500/20 border-b border-green-500/40 text-green-300" : "bg-amber-500/20 border-b border-amber-500/40 text-amber-300"}`}>
          <span className="animate-pulse">{lastSignal.decision === "BUY_CALL" ? "CALL" : "PUT"}</span>
          <span>{lastSignal.source === "autonomous-alpaca-agent" ? "AGENT ALERT" : "NEW SIGNAL"}: {lastSignal.decision} {lastSignal.symbol} · {lastSignal.confidence}% confidence · {lastSignal.confluenceScore || 0}/8 confluence</span>
          <button className="opacity-60 hover:opacity-100" onClick={() => setSignalFlash(false)} aria-label="Dismiss alert">×</button>
        </div>
      )}
      <header className="h-16 border-b border-border/50 flex items-center px-4 sm:px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Ghost size={22} className="text-primary shrink-0" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-primary uppercase">GHOSTAGENT</h1>
          <div className="ml-2 px-2 py-0.5 text-[10px] bg-primary/10 text-primary border border-primary/30 hidden lg:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> DEEPSEEK-R1
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1">
          {navLinks.map((link) => <NavLink key={link.href} {...link}>{link.label}</NavLink>)}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-[10px] text-muted-foreground hidden sm:flex flex-col items-end gap-0.5">
            <span className={`flex items-center gap-1 ${isHealthy ? "text-green-400" : "text-yellow-400"}`}><Wifi size={10} />{isHealthy ? "SYSTEM ONLINE" : "SYSTEM DEGRADED"}</span>
            {isSignedIn && <span className={`flex items-center gap-1 ${connected ? "text-primary" : "text-muted-foreground/50"}`}><span className={`w-1 h-1 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />{connected ? "ALERTS LIVE" : "ALERTS OFF"}</span>}
          </div>
          {isSignedIn && isLoaded && <button title="Enable desktop notifications" onClick={permission !== "granted" ? requestPermission : undefined} className={`p-1.5 border ${permission === "granted" ? "border-primary/30 text-primary" : "border-border/50 text-muted-foreground"}`}>{permission === "granted" ? <Bell size={14} /> : <BellOff size={14} />}</button>}
          {isLoaded && isSignedIn && <UserButton afterSignOutUrl="/" />}
          {isLoaded && !isSignedIn && <SignInButton mode="modal"><button className="text-xs px-3 py-1.5 bg-primary text-primary-foreground uppercase tracking-widest">Sign In</button></SignInButton>}
          <button className="md:hidden p-2 text-muted-foreground border border-border/50" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Toggle navigation">{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
      </header>
      {mobileMenuOpen && <div className="md:hidden border-b border-border/50 bg-background/95 sticky top-16 z-30"><nav className="flex flex-col px-4 py-2">{navLinks.map((link) => <Link key={link.href} href={link.href}><div className={`flex items-center gap-3 px-3 py-3 text-sm uppercase tracking-wider border-l-2 ${link.active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent"}`}>{link.icon}{link.label}</div></Link>)}</nav></div>}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 relative z-10">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, children, active }) {
  return <Link href={href}><div className={`flex items-center gap-1.5 px-2 lg:px-3 py-2 text-xs lg:text-sm uppercase tracking-wider border-b-2 whitespace-nowrap ${active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground"}`}>{icon}<span className="hidden lg:inline">{children}</span></div></Link>;
}

export { Layout };