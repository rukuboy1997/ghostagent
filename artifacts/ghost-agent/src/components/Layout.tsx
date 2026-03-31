import React, { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Users, Store } from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 }
  });

  const isHealthy = health?.status === "ok" || health?.status === "healthy";

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-mono flex flex-col relative overflow-hidden">
      <div className="scanlines" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>
      
      {/* Header */}
      <header className="h-16 border-b border-border/50 flex items-center px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <img src="/ghost-logo.png" alt="GhostAgent" className="h-8 w-8 object-contain filter invert opacity-90" />
          <h1 className="text-xl font-bold tracking-tighter text-primary uppercase glitch-effect" data-text="GHOST_AGENT">
            GHOST_AGENT
          </h1>
          <div className="ml-4 px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/30 uppercase tracking-widest flex items-center gap-2 hidden sm:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            TEE Secure Enclave Active
          </div>
        </div>
        
        <nav className="flex items-center gap-2 sm:gap-6">
          <NavLink href="/" icon={<Activity size={16} />} active={location === "/"}>Console</NavLink>
          <NavLink href="/agents" icon={<Users size={16} />} active={location === "/agents" || location.startsWith("/agents/")}>Operatives</NavLink>
          <NavLink href="/marketplace" icon={<Store size={16} />} active={location === "/marketplace"}>Marketplace</NavLink>
        </nav>
        
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground flex flex-col items-end">
            <span className="hidden sm:inline">ID: 0x9f...3b1a</span>
            <span className={isHealthy ? "text-green-400" : "text-yellow-400"}>
              {isHealthy ? "SYS: ONLINE" : "SYS: DEGRADED"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6 relative z-10">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, icon, children, active }: { href: string; icon: React.ReactNode; children: React.ReactNode; active: boolean }) {
  return (
    <Link href={href}>
      <div className={`flex items-center gap-2 px-2 sm:px-3 py-2 text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 border-b-2 cursor-pointer ${
        active ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
      }`}>
        <span className="hidden sm:inline">{icon}</span>
        {children}
      </div>
    </Link>
  );
}
