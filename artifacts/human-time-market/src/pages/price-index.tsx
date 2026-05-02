import { useListSkillCategories } from "@workspace/api-client-react";
import Navbar from "@/components/navbar";

export default function PriceIndex() {
  const { data: categories, isLoading } = useListSkillCategories();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Time Price Index</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">Real-time market rates across skill categories</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">MARKET STATUS</p>
            <p className="text-sm font-mono text-primary font-medium flex items-center justify-end gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              DATA COLLECTING
            </p>
          </div>
        </div>
        
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="grid grid-cols-12 bg-muted/80 p-4 border-b border-border text-xs font-mono font-bold text-muted-foreground">
            <div className="col-span-5 md:col-span-4">SKILL CATEGORY</div>
            <div className="col-span-3 text-right">LAST RATE</div>
            <div className="col-span-4 md:col-span-3 text-right">24H CHG</div>
            <div className="hidden md:block col-span-2 text-right">VOL (HRS)</div>
          </div>
          
          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading market data...</div>
            ) : categories?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">No categories available</div>
            ) : (
              categories?.flatMap(cat => 
                cat.children.map(child => (
                  <div key={child.id} className="grid grid-cols-12 p-4 items-center text-sm font-mono hover:bg-muted/30 transition-colors">
                    <div className="col-span-5 md:col-span-4">
                      <div className="text-foreground font-medium truncate">{child.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{cat.name}</div>
                    </div>
                    <div className="col-span-3 text-right text-muted-foreground">—</div>
                    <div className="col-span-4 md:col-span-3 text-right text-muted-foreground">—</div>
                    <div className="hidden md:block col-span-2 text-right text-muted-foreground">—</div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
