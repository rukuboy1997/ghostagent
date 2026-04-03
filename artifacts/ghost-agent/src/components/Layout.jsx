import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, Users, Store, Menu, X } from "lucide-react";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";
function Layout({ children }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: health } = useHealthCheck({
    query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 3e4 }
  });
  const isHealthy = health?.status === "ok" || health?.status === "healthy";
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);
  const navLinks = [
    { href: "/", icon: <Activity size={16} />, label: "Console", active: location === "/" },
    { href: "/agents", icon: <Users size={16} />, label: "Operatives", active: location === "/agents" || location.startsWith("/agents/") },
    { href: "/marketplace", icon: <Store size={16} />, label: "Marketplace", active: location === "/marketplace" }
  ];
  return <div className="min-h-screen bg-background text-foreground font-mono flex flex-col relative overflow-hidden">
      <div className="scanlines" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />

      <header className="h-16 border-b border-border/50 flex items-center px-4 sm:px-6 justify-between bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src="/ghost-logo.png" alt="GhostAgent" className="h-8 w-8 object-contain filter invert opacity-90" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tighter text-primary uppercase glitch-effect" data-text="GHOST_AGENT">
            GHOST_AGENT
          </h1>
          <div className="ml-2 px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/30 uppercase tracking-widest items-center gap-2 hidden lg:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            TEE Secure Enclave Active
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 lg:gap-6">
          {navLinks.map((link) => <NavLink key={link.href} href={link.href} icon={link.icon} active={link.active}>
              {link.label}
            </NavLink>)}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-xs text-muted-foreground flex flex-col items-end">
            <span className="hidden sm:inline">ID: 0x9f...3b1a</span>
            <span className={isHealthy ? "text-green-400" : "text-yellow-400"}>
              {isHealthy ? "SYS: ONLINE" : "SYS: DEGRADED"}
            </span>
          </div>
          <button
    className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors border border-border/50 hover:border-border"
    onClick={() => setMobileMenuOpen((prev) => !prev)}
    aria-label="Toggle navigation menu"
  >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && <div className="md:hidden border-b border-border/50 bg-background/95 backdrop-blur-md sticky top-16 z-30">
          <nav className="flex flex-col px-4 py-2">
            {navLinks.map((link) => <Link key={link.href} href={link.href}>
                <div className={`flex items-center gap-3 px-3 py-3 text-sm uppercase tracking-wider transition-all duration-200 border-l-2 cursor-pointer ${link.active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"}`}>
                  {link.icon}
                  {link.label}
                </div>
              </Link>)}
            <div className="px-3 py-2 border-l-2 border-transparent">
              <div className="text-[10px] bg-primary/10 text-primary border border-primary/30 px-2 py-1 rounded uppercase tracking-widest flex items-center gap-2 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                TEE Secure Enclave Active
              </div>
            </div>
          </nav>
        </div>}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 relative z-10">
        {children}
      </main>
    </div>;
}
function NavLink({ href, icon, children, active }) {
  return <Link href={href}>
      <div className={`flex items-center gap-2 px-2 lg:px-3 py-2 text-xs lg:text-sm uppercase tracking-wider transition-all duration-200 border-b-2 cursor-pointer ${active ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"}`}>
        {icon}
        <span className="hidden sm:inline">{children}</span>
      </div>
    </Link>;
}
export {
  Layout
};
