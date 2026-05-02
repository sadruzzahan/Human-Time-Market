import { useListSkillCategories } from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Marketplace() {
  const { data: categories, isLoading } = useListSkillCategories();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">Marketplace</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">Browse active professional time listings</p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search professionals..." 
                className="pl-9 font-mono bg-card"
                data-testid="input-search-marketplace"
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0" data-testid="btn-filter">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
          <Badge variant="default" className="font-mono px-3 py-1 cursor-pointer whitespace-nowrap">ALL MARKETS</Badge>
          {categories?.map(cat => (
            <Badge key={cat.id} variant="outline" className="font-mono px-3 py-1 cursor-pointer whitespace-nowrap text-muted-foreground hover:text-foreground">
              {cat.name.toUpperCase()}
            </Badge>
          ))}
        </div>
        
        <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg bg-card/50">
          <div className="text-center">
            <div className="inline-block p-3 rounded-full bg-muted mb-4">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-mono font-semibold text-foreground">Time listings coming soon</h2>
            <p className="text-sm text-muted-foreground mt-2 font-mono max-w-sm mx-auto">
              The market is currently in pre-launch phase. Professionals are establishing their baselines.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
