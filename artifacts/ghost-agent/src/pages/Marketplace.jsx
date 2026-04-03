import { useGetMarketplace, getGetMarketplaceQueryKey } from "@workspace/api-client-react";
import { Store, Star, Download, Shield, Cpu, Zap, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
function Marketplace() {
  const { data: listings, isLoading } = useGetMarketplace({
    query: { queryKey: getGetMarketplaceQueryKey() }
  });
  return <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Store size={24} /> Strategy Exchange
          </h2>
          <p className="text-muted-foreground text-sm uppercase tracking-wider mt-1">Acquire Verifiable Agent Configurations</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
    type="text"
    placeholder="SEARCH PROTOCOLS..."
    className="bg-background border border-border/50 py-2 pl-9 pr-4 text-xs font-mono w-64 focus:outline-none focus:border-primary transition-colors"
  />
        </div>
      </div>

      {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Card key={i} className="border-border/50 bg-card/50 h-56 animate-pulse" />)}
        </div> : listings?.length === 0 ? <div className="p-16 text-center border border-dashed border-border/50 bg-background/30">
          <Store size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
          <div className="text-lg font-bold text-foreground uppercase tracking-widest">Marketplace Offline</div>
          <div className="text-sm text-muted-foreground mt-2">No strategies currently available for acquisition.</div>
        </div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings?.map((listing) => <div key={listing.id} className="group border border-border/50 bg-card/50 backdrop-blur hover:border-secondary/50 transition-all flex flex-col relative overflow-hidden">
              {listing.isVerified && <div className="absolute top-0 right-0 bg-green-400/20 text-green-400 text-[10px] uppercase tracking-widest px-3 py-1 border-b border-l border-green-400/30 flex items-center gap-1 z-10">
                  <Shield size={10} /> Verified
                </div>}
              
              <div className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between mt-2">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-secondary transition-colors uppercase tracking-widest">
                    {listing.agentName}
                  </h3>
                </div>
                
                <div className="text-xs text-secondary border border-secondary/30 px-2 py-0.5 inline-block w-fit uppercase bg-secondary/5">
                  {listing.category}
                </div>

                <p className="text-sm text-foreground/70 font-mono mt-2 flex-1">
                  {listing.strategy}
                </p>
                {listing.description && <p className="text-xs text-muted-foreground line-clamp-2">
                    {listing.description}
                  </p>}

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/30 text-xs font-mono">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Star size={12} className="text-primary" /> {listing.reputationScore} REP
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Zap size={12} className="text-primary" /> {listing.successRate}% SR
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Download size={12} className="text-primary" /> {listing.rentals} IMPLANTS
                  </div>
                  <div className="flex items-center gap-1 font-bold text-foreground">
                    {listing.price} / mo
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-secondary/10 hover:bg-secondary text-secondary hover:text-secondary-foreground transition-colors font-bold uppercase tracking-widest text-xs border-t border-secondary/30 flex items-center justify-center gap-2">
                <Cpu size={14} /> Acquire Configuration
              </button>
            </div>)}
        </div>}
    </div>;
}
export {
  Marketplace as default
};
