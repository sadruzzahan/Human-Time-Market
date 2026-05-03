import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  useListSecondaryListings,
  useListOptions,
  useListBundles,
  usePurchaseSecondaryListing,
  usePurchaseOption,
  usePurchaseBundle,
  useListSkillCategories,
  type SecondaryListingDetail,
  type TimeOptionDetail,
  type BundleDetail,
} from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeftRight,
  Clock,
  TrendingUp,
  Package,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  DollarSign,
  Layers,
} from "lucide-react";

const PAGE_SIZE = 12;

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtRate(cents: number) {
  return `$${(cents / 100).toFixed(0)}/hr`;
}

function timeRemaining(endDate: string | Date): string {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days > 60) return `${Math.floor(days / 30)}mo remaining`;
  if (days > 0) return `${days}d remaining`;
  return "< 1d remaining";
}

function SecondaryListingCard({
  item,
  onBuy,
  isSignedIn,
}: {
  item: SecondaryListingDetail;
  onBuy: (item: SecondaryListingDetail) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-primary mb-0.5 uppercase tracking-wider">{item.skillCategoryName}</p>
          <h3 className="text-sm font-semibold text-foreground leading-snug truncate">{item.originalListingTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">by {item.professionalDisplayName}</p>
        </div>
        <Badge variant="outline" className="font-mono text-xs shrink-0 text-emerald-400 border-emerald-400/40 bg-emerald-400/10">
          RESALE
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{item.hoursPerWeek} hrs/wk</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="font-mono">{timeRemaining(item.endDate)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span>Seller: {item.sellerDisplayName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <DollarSign className="h-3 w-3 shrink-0 text-primary" />
          <span className="font-mono text-primary">{fmt(item.askPriceCents)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono border-t border-border/40 pt-2">
        <span>Orig rate: <span className="text-foreground">{fmtRate(item.originalRateCents)}</span></span>
        <span>{item.startDate} – {item.endDate}</span>
      </div>

      <Button
        size="sm"
        className="w-full font-mono text-xs mt-auto"
        disabled={!isSignedIn}
        onClick={() => onBuy(item)}
      >
        Purchase Contract
      </Button>
    </div>
  );
}

function OptionCard({
  item,
  onBuy,
  isSignedIn,
}: {
  item: TimeOptionDetail;
  onBuy: (item: TimeOptionDetail) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs text-primary mb-0.5 uppercase tracking-wider">{item.skillCategoryName}</p>
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {item.hours}h Option · {item.professionalDisplayName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Window: {item.windowStart} – {item.windowEnd}
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs shrink-0 text-yellow-400 border-yellow-400/40 bg-yellow-400/10">
          OPTION
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Premium</p>
          <p className="font-mono text-primary font-semibold">{fmt(item.premiumCents)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">If Exercised</p>
          <p className="font-mono text-foreground font-semibold">{fmtRate(item.fullRateCents)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Hours Covered</p>
          <p className="font-mono text-foreground">{item.hours}h</p>
        </div>
        {item.expiresAt && (
          <div>
            <p className="text-muted-foreground">Expires</p>
            <p className="font-mono text-foreground text-[11px]">
              {new Date(item.expiresAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full font-mono text-xs mt-auto border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10"
        disabled={!isSignedIn}
        onClick={() => onBuy(item)}
      >
        Buy Option · {fmt(item.premiumCents)}
      </Button>
    </div>
  );
}

function BundleCard({
  item,
  onBuy,
  isSignedIn,
}: {
  item: BundleDetail;
  onBuy: (item: BundleDetail) => void;
  isSignedIn: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">by {item.creatorDisplayName}</p>
        </div>
        <Badge variant="outline" className="font-mono text-xs shrink-0 text-blue-400 border-blue-400/40 bg-blue-400/10">
          BUNDLE
        </Badge>
      </div>

      <div className="space-y-1">
        {item.items.slice(0, 3).map((bi) => (
          <div key={bi.id} className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate">{bi.professionalDisplayName} · {bi.skillCategoryName}</span>
            <span className="font-mono shrink-0 ml-2">{bi.hours}h</span>
          </div>
        ))}
        {item.items.length > 3 && (
          <p className="text-xs text-muted-foreground">+{item.items.length - 3} more</p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs border-t border-border pt-2">
        <span className="text-muted-foreground">{item.items.length} professionals · {item.items.reduce((s, i) => s + i.hours, 0)}h total</span>
        <span className="font-mono font-semibold text-primary">{fmt(item.totalPriceCents)}</span>
      </div>

      <Button
        size="sm"
        className="w-full font-mono text-xs mt-auto"
        disabled={!isSignedIn}
        onClick={() => onBuy(item)}
      >
        Purchase Bundle
      </Button>
    </div>
  );
}

export default function SecondaryMarket() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("secondary");
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [slPage, setSlPage] = useState(0);
  const [optPage, setOptPage] = useState(0);
  const [bndPage, setBndPage] = useState(0);
  const [confirmItem, setConfirmItem] = useState<
    | { kind: "secondary"; item: SecondaryListingDetail }
    | { kind: "option"; item: TimeOptionDetail }
    | { kind: "bundle"; item: BundleDetail }
    | null
  >(null);

  const { data: skillCats } = useListSkillCategories();
  const skillCategoryId = skillFilter !== "all" ? Number(skillFilter) : undefined;

  const { data: slData, isLoading: slLoading, refetch: slRefetch } = useListSecondaryListings({
    skillCategoryId,
    limit: PAGE_SIZE,
    offset: slPage * PAGE_SIZE,
  });
  const { data: optData, isLoading: optLoading, refetch: optRefetch } = useListOptions({
    skillCategoryId,
    limit: PAGE_SIZE,
    offset: optPage * PAGE_SIZE,
  });
  const { data: bndData, isLoading: bndLoading, refetch: bndRefetch } = useListBundles({
    limit: PAGE_SIZE,
    offset: bndPage * PAGE_SIZE,
  });

  const purchaseSl = usePurchaseSecondaryListing();
  const purchaseOpt = usePurchaseOption();
  const purchaseBnd = usePurchaseBundle();

  function handleConfirm() {
    if (!confirmItem) return;

    if (confirmItem.kind === "secondary") {
      purchaseSl.mutate(
        { id: confirmItem.item.id },
        {
          onSuccess: () => {
            toast({ title: "Contract purchased", description: "You've successfully acquired the contract." });
            setConfirmItem(null);
            slRefetch();
          },
          onError: (e: Error) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
        },
      );
    } else if (confirmItem.kind === "option") {
      purchaseOpt.mutate(
        { id: confirmItem.item.id },
        {
          onSuccess: () => {
            toast({ title: "Option purchased", description: "You hold the option to engage this professional." });
            setConfirmItem(null);
            optRefetch();
          },
          onError: (e: Error) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
        },
      );
    } else {
      purchaseBnd.mutate(
        { id: confirmItem.item.id },
        {
          onSuccess: () => {
            toast({ title: "Bundle purchased", description: "All professionals in the bundle are now engaged." });
            setConfirmItem(null);
            bndRefetch();
          },
          onError: (e: Error) => toast({ title: "Purchase failed", description: e.message, variant: "destructive" }),
        },
      );
    }
  }

  const isMutating = purchaseSl.isPending || purchaseOpt.isPending || purchaseBnd.isPending;

  const allSkillCategories = skillCats?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Navbar />

      <div className="container py-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Secondary Market
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Resale contracts, time options, and professional bundles
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Select value={skillFilter} onValueChange={setSkillFilter}>
              <SelectTrigger className="h-8 w-44 text-xs font-mono">
                <SelectValue placeholder="All skills" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All skills</SelectItem>
                {allSkillCategories.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="secondary" className="gap-1.5 font-mono text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Resale
              {slData?.total != null && (
                <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0 text-[10px] font-mono">
                  {slData.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-1.5 font-mono text-xs">
              <Clock className="h-3.5 w-3.5" />
              Options
              {optData?.total != null && (
                <span className="ml-1 rounded-full bg-yellow-400/20 text-yellow-400 px-1.5 py-0 text-[10px] font-mono">
                  {optData.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bundles" className="gap-1.5 font-mono text-xs">
              <Package className="h-3.5 w-3.5" />
              Bundles
              {bndData?.total != null && (
                <span className="ml-1 rounded-full bg-blue-400/20 text-blue-400 px-1.5 py-0 text-[10px] font-mono">
                  {bndData.total}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="secondary">
            {slLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-md" />
                ))}
              </div>
            ) : !slData?.items.length ? (
              <EmptyState
                icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />}
                title="No resale contracts"
                desc="Committed contract holders can list their contracts here for resale."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slData.items.map((item) => (
                    <SecondaryListingCard
                      key={item.id}
                      item={item}
                      isSignedIn={!!isSignedIn}
                      onBuy={(i) => setConfirmItem({ kind: "secondary", item: i })}
                    />
                  ))}
                </div>
                <Pagination
                  page={slPage}
                  total={slData.total}
                  pageSize={PAGE_SIZE}
                  onPrev={() => setSlPage((p) => Math.max(0, p - 1))}
                  onNext={() => setSlPage((p) => p + 1)}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="options">
            {optLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-md" />
                ))}
              </div>
            ) : !optData?.items.length ? (
              <EmptyState
                icon={<Clock className="h-8 w-8 text-muted-foreground" />}
                title="No time options"
                desc="Professionals can offer options — pay a premium now for the right to engage later."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {optData.items.map((item) => (
                    <OptionCard
                      key={item.id}
                      item={item}
                      isSignedIn={!!isSignedIn}
                      onBuy={(i) => setConfirmItem({ kind: "option", item: i })}
                    />
                  ))}
                </div>
                <Pagination
                  page={optPage}
                  total={optData.total}
                  pageSize={PAGE_SIZE}
                  onPrev={() => setOptPage((p) => Math.max(0, p - 1))}
                  onNext={() => setOptPage((p) => p + 1)}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="bundles">
            {bndLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-md" />
                ))}
              </div>
            ) : !bndData?.items.length ? (
              <EmptyState
                icon={<Package className="h-8 w-8 text-muted-foreground" />}
                title="No bundles available"
                desc="Curated bundles of professional time across multiple experts."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bndData.items.map((item) => (
                    <BundleCard
                      key={item.id}
                      item={item}
                      isSignedIn={!!isSignedIn}
                      onBuy={(i) => setConfirmItem({ kind: "bundle", item: i })}
                    />
                  ))}
                </div>
                <Pagination
                  page={bndPage}
                  total={bndData.total}
                  pageSize={PAGE_SIZE}
                  onPrev={() => setBndPage((p) => Math.max(0, p - 1))}
                  onNext={() => setBndPage((p) => p + 1)}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!confirmItem} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-mono">
              {confirmItem?.kind === "secondary" && "Purchase Contract"}
              {confirmItem?.kind === "option" && "Purchase Option"}
              {confirmItem?.kind === "bundle" && "Purchase Bundle"}
            </DialogTitle>
            <DialogDescription>
              {confirmItem?.kind === "secondary" &&
                `You are purchasing a resale contract from ${confirmItem.item.sellerDisplayName} for ${fmt(confirmItem.item.askPriceCents)}. The underlying commitment to ${confirmItem.item.professionalDisplayName} will transfer to you.`}
              {confirmItem?.kind === "option" &&
                `You are paying a premium of ${fmt((confirmItem.item as TimeOptionDetail).premiumCents)} for the right to engage ${(confirmItem.item as TimeOptionDetail).professionalDisplayName} for ${(confirmItem.item as TimeOptionDetail).hours} hours at ${fmtRate((confirmItem.item as TimeOptionDetail).fullRateCents)}.`}
              {confirmItem?.kind === "bundle" &&
                `You are purchasing a bundle of ${(confirmItem.item as BundleDetail).items.length} professionals for ${fmt((confirmItem.item as BundleDetail).totalPriceCents)}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isMutating}>
              {isMutating ? "Processing…" : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 0}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground font-mono">
        {page + 1} / {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages - 1}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
