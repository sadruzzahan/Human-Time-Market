import { useParams } from "wouter";
import { useGetPublicProfile } from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Award, Terminal } from "lucide-react";

export default function ProfileUser() {
  const params = useParams();
  const userId = params.userId as string;

  const { data: profile, isLoading, isError } = useGetPublicProfile(userId, {
    query: {
      enabled: !!userId,
      retry: false
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Terminal className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-mono font-bold">Profile Not Found</h1>
            <p className="text-muted-foreground font-mono">This participant does not exist in the market.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card className="bg-card border-border overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-primary/20 to-accent/20 border-b border-border"></div>
              <CardContent className="pt-0 relative">
                <div className="h-20 w-20 rounded-lg bg-background border-2 border-border absolute -top-10 flex items-center justify-center text-3xl font-mono font-bold text-muted-foreground shadow-sm">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="pt-14 pb-2">
                  <h1 className="text-2xl font-bold font-mono tracking-tight">{profile.displayName}</h1>
                  <p className="text-sm text-muted-foreground font-mono mt-1 capitalize">
                    {profile.experienceLevel} Participant
                  </p>
                </div>
                
                <div className="space-y-3 mt-6 pt-6 border-t border-border/50">
                  <div className="flex items-center text-sm font-mono text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4 text-primary" />
                    {profile.timezone || "Timezone undisclosed"}
                  </div>
                  <div className="flex items-center text-sm font-mono text-muted-foreground">
                    <Clock className="mr-2 h-4 w-4 text-primary" />
                    Market Active
                  </div>
                  <div className="flex items-center text-sm font-mono text-muted-foreground">
                    <Award className="mr-2 h-4 w-4 text-primary" />
                    ID: {profile.id}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-sm text-muted-foreground">MARKET PRICING</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold font-mono">
                    {profile.hourlyRateBaselineCents ? `$${(profile.hourlyRateBaselineCents / 100).toFixed(2)}` : "TBD"}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono">/ hr</span>
                </div>
                <Button className="w-full mt-6 font-mono font-bold" data-testid="btn-initiate-trade">
                  INITIATE TRADE
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-lg">Participant Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {profile.bio || "No overview provided."}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono text-lg">Active Markets</CardTitle>
              </CardHeader>
              <CardContent>
                {profile.skills && profile.skills.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.skills.map((category) => (
                      <div key={category.id} className="space-y-2">
                        <h4 className="text-xs font-mono font-bold text-muted-foreground">{category.name.toUpperCase()}</h4>
                        <div className="flex flex-wrap gap-2">
                          {category.children.map(child => (
                            <Badge key={child.id} variant="secondary" className="font-mono font-normal bg-primary/10 text-primary hover:bg-primary/20">
                              {child.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground font-mono text-sm">No market positioning configured.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
