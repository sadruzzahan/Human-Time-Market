import Navbar from "@/components/navbar";

export default function Dashboard() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your market positions and active commitments</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-lg bg-card/50">
          <div className="text-center">
            <h2 className="text-xl font-mono font-semibold text-muted-foreground">Dashboard coming soon</h2>
          </div>
        </div>
      </main>
    </div>
  );
}
