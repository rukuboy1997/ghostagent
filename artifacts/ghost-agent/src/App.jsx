import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Trading from "@/pages/Trading";
import Account from "@/pages/Account";
import ConnectMT5 from "@/pages/ConnectMT5";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

const CLERK_PK = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_API_URL || "";
const CLERK_PROXY = API_URL ? `${API_URL.replace(/\/$/, "")}/clerk` : undefined;

function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 py-12">
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold uppercase tracking-widest text-primary mb-2">
          Sign in to GhostAgent
        </h2>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          Connect your MT5 account and start trading with AI
        </p>
      </div>
      <SignIn routing="hash" />
    </div>
  );
}

function ProtectedRoute({ component: Component }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-primary font-mono text-sm uppercase tracking-widest animate-pulse">
        Loading...
      </div>
    );
  }
  if (!isSignedIn) return <SignInPage />;
  return <Component />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/trading" component={() => <ProtectedRoute component={Trading} />} />
        <Route path="/connect-mt5" component={() => <ProtectedRoute component={ConnectMT5} />} />
        <Route path="/account" component={() => <ProtectedRoute component={Account} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PK} proxyUrl={CLERK_PROXY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
