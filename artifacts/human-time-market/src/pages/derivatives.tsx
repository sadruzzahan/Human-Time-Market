import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  useGetDerivativesPortfolio,
  getGetDerivativesPortfolioQueryKey,
  useCancelSecondaryListing,
  useExerciseOption,
  useAcceptSwap,
  useDeclineSwap,
  useCancelBundle,
  type SecondaryListingDetail,
  type TimeOptionDetail,
  type TimeSwapDetail,
  type BundleDetail,
} from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Clock,
  ArrowLeftRight,
  Package,
  CheckCircle,
  XCircle,
  Zap,
  DollarSign,
  Calendar,
  Users,
  Layers,
} from "lucide-react";

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtRate(cents: number) {
  return `$${(cents / 100).toFixed(0)}/hr`;
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    open: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    sold: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    cancelled: "text-muted-foreground border-border bg-muted",
    purchased: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    exercised: "text-primary border-primary/40 bg-primary/10",
    expired: "text-destructive border-destructive/40 bg-destructive/10",
    proposed: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    accepted: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
    declined: "text-destructive border-destructive/40 bg-destructive/10",
    completed: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  };
  return map[status] ?? "text-muted-foreground border-border bg-muted";
}

function SecondaryListingsTab({
  items,
  refetch,
  currentUserId,
}: {
  items: SecondaryListingDetail[];
  refetch: () => void;
  currentUserId: number | undefined;
}) {
  const { toast } = useToast();
  const cancel = useCancelSecondaryListing();

  if (!items.length) {
    return <EmptyState icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />} title="No secondary listings" desc="List committed contracts for resale to see them here." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-border bg-card p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-primary uppercase">{item.skillCategoryName}</span>
              <Badge variant="outline" className={`font-mono text-[10px] ${statusColor(item.status)}`}>
                {item.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">{item.originalListingTitle}</p>
            <p className="text-xs text-muted-foreground">
              {item.status === "sold" ? `Sold to buyer` : `Listed for resale`} · Ask: {fmt(item.askPriceCents)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.hoursPerWeek}h/wk · {item.startDate} – {item.endDate} · {item.professionalDisplayName}
            </p>
          </div>
          {item.status === "open" && item.sellerId === currentUserId && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 font-mono text-xs shrink-0"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { id: item.id },
                  {
                    onSuccess: () => { toast({ title: "Listing cancelled" }); refetch(); },
                    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                  },
                )
              }
            >
              Cancel
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function OptionsTab({
  items,
  refetch,
  currentUserId,
}: {
  items: TimeOptionDetail[];
  refetch: () => void;
  currentUserId: number | undefined;
}) {
  const { toast } = useToast();
  const exercise = useExerciseOption();

  if (!items.length) {
    return <EmptyState icon={<Clock className="h-8 w-8 text-muted-foreground" />} title="No options" desc="Create or purchase time options to see them here." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-border bg-card p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-primary uppercase">{item.skillCategoryName}</span>
              <Badge variant="outline" className={`font-mono text-[10px] ${statusColor(item.status)}`}>
                {item.status.toUpperCase()}
              </Badge>
              {item.professionalId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border">
                  CREATED
                </Badge>
              )}
              {item.holderId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-yellow-400 border-yellow-400/40 bg-yellow-400/10">
                  HOLDER
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {item.hours}h option · {item.professionalDisplayName}
            </p>
            <p className="text-xs text-muted-foreground">
              Window: {item.windowStart} – {item.windowEnd} · Premium: {fmt(item.premiumCents)} · Rate: {fmtRate(item.fullRateCents)}
            </p>
            {item.exercisedAt && (
              <p className="text-xs text-primary mt-0.5">Exercised {new Date(item.exercisedAt).toLocaleDateString()}</p>
            )}
          </div>
          {item.status === "purchased" && item.holderId === currentUserId && (
            <Button
              size="sm"
              className="font-mono text-xs shrink-0 gap-1.5"
              disabled={exercise.isPending}
              onClick={() =>
                exercise.mutate(
                  { id: item.id },
                  {
                    onSuccess: () => { toast({ title: "Option exercised", description: "The option has been converted to a commitment." }); refetch(); },
                    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                  },
                )
              }
            >
              <Zap className="h-3 w-3" />
              Exercise
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function SwapsTab({
  items,
  refetch,
  currentUserId,
}: {
  items: TimeSwapDetail[];
  refetch: () => void;
  currentUserId: number | undefined;
}) {
  const { toast } = useToast();
  const accept = useAcceptSwap();
  const decline = useDeclineSwap();

  if (!items.length) {
    return <EmptyState icon={<ArrowLeftRight className="h-8 w-8 text-muted-foreground" />} title="No swaps" desc="Propose or receive time swaps with other professionals." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className={`font-mono text-[10px] ${statusColor(item.status)}`}>
                  {item.status.toUpperCase()}
                </Badge>
                {item.proposerId === currentUserId && (
                  <span className="text-[10px] font-mono text-muted-foreground">PROPOSED BY YOU</span>
                )}
                {item.counterpartyId === currentUserId && (
                  <span className="text-[10px] font-mono text-muted-foreground">INCOMING</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-mono uppercase text-[10px]">You offer</p>
                  <p className="font-medium">{item.proposerDisplayName}</p>
                  <p className="text-muted-foreground">{item.proposerHours}h · {item.proposerSkillCategoryName}</p>
                  <p className="text-muted-foreground truncate">{item.proposerListingTitle}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground font-mono uppercase text-[10px]">In exchange for</p>
                  <p className="font-medium">{item.counterpartyDisplayName}</p>
                  <p className="text-muted-foreground">{item.counterpartyHours}h · {item.counterpartySkillCategoryName}</p>
                  {item.counterpartyListingTitle && (
                    <p className="text-muted-foreground truncate">{item.counterpartyListingTitle}</p>
                  )}
                </div>
              </div>
              {item.note && (
                <p className="text-xs text-muted-foreground mt-2 italic">"{item.note}"</p>
              )}
            </div>
            {item.status === "proposed" && item.counterpartyId === currentUserId && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="font-mono text-xs gap-1.5 h-7"
                  disabled={accept.isPending || decline.isPending}
                  onClick={() =>
                    accept.mutate(
                      { id: item.id },
                      {
                        onSuccess: () => { toast({ title: "Swap accepted" }); refetch(); },
                        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                      },
                    )
                  }
                >
                  <CheckCircle className="h-3 w-3" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs gap-1.5 h-7 text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={accept.isPending || decline.isPending}
                  onClick={() =>
                    decline.mutate(
                      { id: item.id },
                      {
                        onSuccess: () => { toast({ title: "Swap declined" }); refetch(); },
                        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                      },
                    )
                  }
                >
                  <XCircle className="h-3 w-3" /> Decline
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BundlesTab({
  items,
  refetch,
  currentUserId,
}: {
  items: BundleDetail[];
  refetch: () => void;
  currentUserId: number | undefined;
}) {
  const { toast } = useToast();
  const cancel = useCancelBundle();

  if (!items.length) {
    return <EmptyState icon={<Package className="h-8 w-8 text-muted-foreground" />} title="No bundles" desc="Create bundles of professional time to sell as a package." />;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border border-border bg-card p-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`font-mono text-[10px] ${statusColor(item.status)}`}>
                {item.status.toUpperCase()}
              </Badge>
              {item.creatorId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border">
                  CREATED
                </Badge>
              )}
              {item.buyerId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-blue-400 border-blue-400/40 bg-blue-400/10">
                  PURCHASED
                </Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
            <div className="mt-2 space-y-0.5">
              {item.items.slice(0, 3).map((bi) => (
                <p key={bi.id} className="text-xs text-muted-foreground">
                  {bi.professionalDisplayName} · {bi.skillCategoryName} · {bi.hours}h
                </p>
              ))}
              {item.items.length > 3 && (
                <p className="text-xs text-muted-foreground">+{item.items.length - 3} more</p>
              )}
            </div>
            <p className="text-xs font-mono text-primary font-semibold mt-2">
              {fmt(item.totalPriceCents)} · {item.items.length} professionals · {item.items.reduce((s, i) => s + i.hours, 0)}h total
            </p>
          </div>
          {item.status === "open" && item.creatorId === currentUserId && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 font-mono text-xs shrink-0"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { id: item.id },
                  {
                    onSuccess: () => { toast({ title: "Bundle cancelled" }); refetch(); },
                    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                  },
                )
              }
            >
              Cancel
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}

export default function Derivatives() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState("secondary");

  const { data, isLoading, refetch } = useGetDerivativesPortfolio({
    query: { enabled: !!isSignedIn, queryKey: getGetDerivativesPortfolioQueryKey() },
  });

  const pendingSwaps = data?.swaps.filter((s) => s.status === "proposed").length ?? 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Navbar />

      <div className="container py-6 flex-1">
        <div className="mb-6">
          <h1 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Derivatives Portfolio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your secondary listings, time options, swaps, and bundles
          </p>
        </div>

        {!isSignedIn ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Layers className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Sign in to view your portfolio</p>
            <p className="text-sm text-muted-foreground">Track all your derivatives instruments in one place.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-md" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Resale Listings"
                value={data?.secondaryListings.length ?? 0}
                icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                color="text-emerald-400"
              />
              <StatCard
                label="Options"
                value={data?.options.length ?? 0}
                icon={<Clock className="h-4 w-4 text-yellow-400" />}
                color="text-yellow-400"
              />
              <StatCard
                label="Swaps"
                value={data?.swaps.length ?? 0}
                badge={pendingSwaps > 0 ? `${pendingSwaps} pending` : undefined}
                icon={<ArrowLeftRight className="h-4 w-4 text-primary" />}
                color="text-primary"
              />
              <StatCard
                label="Bundles"
                value={data?.bundles.length ?? 0}
                icon={<Package className="h-4 w-4 text-blue-400" />}
                color="text-blue-400"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="secondary" className="font-mono text-xs gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Resale
                  {(data?.secondaryListings.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-400/20 text-emerald-400 px-1.5 text-[10px]">
                      {data!.secondaryListings.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="options" className="font-mono text-xs gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Options
                  {(data?.options.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400/20 text-yellow-400 px-1.5 text-[10px]">
                      {data!.options.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="swaps" className="font-mono text-xs gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Swaps
                  {pendingSwaps > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400/20 text-yellow-400 px-1.5 text-[10px]">
                      {pendingSwaps}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bundles" className="font-mono text-xs gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Bundles
                  {(data?.bundles.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-blue-400/20 text-blue-400 px-1.5 text-[10px]">
                      {data!.bundles.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="secondary">
                <SecondaryListingsTab
                  items={data?.secondaryListings ?? []}
                  refetch={refetch}
                  currentUserId={undefined}
                />
              </TabsContent>
              <TabsContent value="options">
                <OptionsTab
                  items={data?.options ?? []}
                  refetch={refetch}
                  currentUserId={undefined}
                />
              </TabsContent>
              <TabsContent value="swaps">
                <SwapsTab
                  items={data?.swaps ?? []}
                  refetch={refetch}
                  currentUserId={undefined}
                />
              </TabsContent>
              <TabsContent value="bundles">
                <BundlesTab
                  items={data?.bundles ?? []}
                  refetch={refetch}
                  currentUserId={undefined}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  badge,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        {icon}
        {badge && (
          <span className="text-[9px] font-mono text-yellow-400 border border-yellow-400/40 bg-yellow-400/10 rounded-full px-1.5">
            {badge}
          </span>
        )}
      </div>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{label}</p>
    </div>
  );
}
