import { useState } from "react";
import { useAuth } from "@clerk/react";
import {
  useGetDerivativesPortfolio,
  getGetDerivativesPortfolioQueryKey,
  useCancelSecondaryListing,
  useCreateSecondaryListing,
  useExerciseOption,
  useExpireOption,
  useAcceptSwap,
  useDeclineSwap,
  useCancelBundle,
  useGetMyProfile,
  getGetMyProfileQueryKey,
  useCreateOption,
  useProposeSwap,
  useCreateBundle,
  useListSkillCategories,
  getListSkillCategoriesQueryKey,
  useGetMyListings,
  getGetMyListingsQueryKey,
  useGetBuyerCommitments,
  getGetBuyerCommitmentsQueryKey,
  type SecondaryListingDetail,
  type TimeOptionDetail,
  type TimeSwapDetail,
  type BundleDetail,
  type SkillCategory,
  type ListingDetail,
  type BuyerCommitment,
} from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  Clock,
  ArrowLeftRight,
  Package,
  CheckCircle,
  XCircle,
  Zap,
  Layers,
  Plus,
  TimerOff,
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

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon}
      <p className="font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>
    </div>
  );
}

function StatCard({
  label, value, icon, color, badge,
}: {
  label: string; value: number; icon: React.ReactNode; color: string; badge?: string;
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

function timeRemaining(endDate: string): string {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / 86400000);
  if (days > 30) return `${Math.floor(days / 30)}mo remaining`;
  if (days > 0) return `${days}d remaining`;
  return "< 1d remaining";
}

function SecondaryListingsTab({
  items, refetch, currentUserId,
}: { items: SecondaryListingDetail[]; refetch: () => void; currentUserId: number | undefined }) {
  const { toast } = useToast();
  const cancel = useCancelSecondaryListing();

  if (!items.length) {
    return <EmptyState icon={<TrendingUp className="h-8 w-8 text-muted-foreground" />} title="No secondary listings" desc="List committed contracts for resale or purchase one from the market." />;
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
              {item.sellerId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border">SELLING</Badge>
              )}
              {item.buyerId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-blue-400 border-blue-400/40 bg-blue-400/10">PURCHASED</Badge>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground">{item.originalListingTitle}</p>
            <div className="flex flex-wrap gap-x-3 mt-0.5">
              <p className="text-xs text-muted-foreground">
                Ask: <span className="font-mono text-foreground">{fmt(item.askPriceCents)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Orig. rate: <span className="font-mono text-muted-foreground">{fmtRate(item.originalRateCents)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {timeRemaining(item.endDate)}
              </p>
            </div>
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
                cancel.mutate({ id: item.id }, {
                  onSuccess: () => { toast({ title: "Listing cancelled" }); refetch(); },
                  onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                })
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

function CreateResaleListingDialog({
  open, onClose, buyerCommitments, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  buyerCommitments: BuyerCommitment[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const createResale = useCreateSecondaryListing();
  const [form, setForm] = useState({ originalListingId: "", askPriceDollars: "" });

  const eligibleContracts = buyerCommitments.filter((c) => c.status === "committed");

  function handleSubmit() {
    const originalListingId = Number(form.originalListingId);
    const askPriceCents = Math.round(Number(form.askPriceDollars) * 100);
    if (!originalListingId || askPriceCents < 1) {
      toast({ title: "Please select a contract and set an ask price", variant: "destructive" });
      return;
    }
    createResale.mutate(
      { data: { originalListingId, askPriceCents } },
      {
        onSuccess: () => {
          toast({ title: "Contract listed for resale" });
          setForm({ originalListingId: "", askPriceDollars: "" });
          onClose();
          onSuccess();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">List Contract for Resale</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {eligibleContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              You have no committed contracts eligible for resale.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-mono">Your Committed Contract *</Label>
                <Select value={form.originalListingId} onValueChange={(v) => setForm((f) => ({ ...f, originalListingId: v }))}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Select contract to resell…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleContracts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)} className="font-mono text-sm">
                        {c.title} · {fmtRate(c.rateCents)} · {c.skillCategoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-mono">Ask Price ($) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 8000"
                  value={form.askPriceDollars}
                  onChange={(e) => setForm((f) => ({ ...f, askPriceDollars: e.target.value }))}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Price for full transfer of this contracted engagement</p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>Cancel</Button>
          {eligibleContracts.length > 0 && (
            <Button size="sm" className="font-mono text-xs" disabled={createResale.isPending} onClick={handleSubmit}>
              List for Resale
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionsTab({
  items, refetch, currentUserId,
}: { items: TimeOptionDetail[]; refetch: () => void; currentUserId: number | undefined }) {
  const { toast } = useToast();
  const exercise = useExerciseOption();
  const expire = useExpireOption();

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
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border">CREATED</Badge>
              )}
              {item.holderId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-yellow-400 border-yellow-400/40 bg-yellow-400/10">HOLDER</Badge>
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
            {item.expiresAt && item.status === "purchased" && (
              <p className="text-xs text-muted-foreground mt-0.5">Expires {new Date(item.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {item.status === "purchased" && item.holderId === currentUserId && (
              <>
                <Button
                  size="sm"
                  className="font-mono text-xs gap-1.5 h-7"
                  disabled={exercise.isPending || expire.isPending}
                  onClick={() =>
                    exercise.mutate({ id: item.id }, {
                      onSuccess: () => { toast({ title: "Option exercised", description: "Converted to a commitment." }); refetch(); },
                      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                    })
                  }
                >
                  <Zap className="h-3 w-3" /> Exercise
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs gap-1.5 h-7 text-muted-foreground"
                  disabled={exercise.isPending || expire.isPending}
                  onClick={() =>
                    expire.mutate({ id: item.id }, {
                      onSuccess: () => { toast({ title: "Option let expire" }); refetch(); },
                      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                    })
                  }
                >
                  <TimerOff className="h-3 w-3" /> Let Expire
                </Button>
              </>
            )}
            {item.status === "open" && item.professionalId === currentUserId && (
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-xs gap-1.5 h-7 text-muted-foreground"
                disabled={expire.isPending}
                onClick={() =>
                  expire.mutate({ id: item.id }, {
                    onSuccess: () => { toast({ title: "Option cancelled" }); refetch(); },
                    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                  })
                }
              >
                <TimerOff className="h-3 w-3" /> Cancel
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SwapsTab({
  items, refetch, currentUserId,
}: { items: TimeSwapDetail[]; refetch: () => void; currentUserId: number | undefined }) {
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
              {item.note && <p className="text-xs text-muted-foreground mt-2 italic">"{item.note}"</p>}
            </div>
            {item.status === "proposed" && item.counterpartyId === currentUserId && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="font-mono text-xs gap-1.5 h-7"
                  disabled={accept.isPending || decline.isPending}
                  onClick={() =>
                    accept.mutate({ id: item.id }, {
                      onSuccess: () => { toast({ title: "Swap accepted" }); refetch(); },
                      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                    })
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
                    decline.mutate({ id: item.id }, {
                      onSuccess: () => { toast({ title: "Swap declined" }); refetch(); },
                      onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                    })
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
  items, refetch, currentUserId,
}: { items: BundleDetail[]; refetch: () => void; currentUserId: number | undefined }) {
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
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-border">CREATED</Badge>
              )}
              {item.buyerId === currentUserId && (
                <Badge variant="outline" className="font-mono text-[10px] text-blue-400 border-blue-400/40 bg-blue-400/10">PURCHASED</Badge>
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
                cancel.mutate({ id: item.id }, {
                  onSuccess: () => { toast({ title: "Bundle cancelled" }); refetch(); },
                  onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
                })
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

function flattenSkillCategories(cats: SkillCategory[]): { id: number; name: string; parentName: string }[] {
  return cats.flatMap((cat) =>
    (cat.children ?? []).map((child) => ({ id: child.id, name: child.name, parentName: cat.name })),
  );
}

function CreateOptionDialog({
  open, onClose, skillCategories, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  skillCategories: SkillCategory[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const createOpt = useCreateOption();
  const [form, setForm] = useState({
    skillCategoryId: "",
    hours: "8",
    windowStart: "",
    windowEnd: "",
    fullRateCents: "",
    premiumCents: "",
    expiresAt: "",
  });

  const flat = flattenSkillCategories(skillCategories);

  function handleSubmit() {
    const skillId = Number(form.skillCategoryId);
    const hours = Number(form.hours);
    const fullRate = Math.round(Number(form.fullRateCents) * 100);
    if (!skillId || hours < 1 || !form.windowStart || !form.windowEnd || fullRate < 1) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const premium = form.premiumCents ? Math.round(Number(form.premiumCents) * 100) : undefined;
    createOpt.mutate(
      {
        data: {
          skillCategoryId: skillId,
          hours,
          windowStart: form.windowStart,
          windowEnd: form.windowEnd,
          fullRateCents: fullRate,
          ...(premium ? { premiumCents: premium } : {}),
          ...(form.expiresAt ? { expiresAt: form.expiresAt } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Option created" });
          onClose();
          onSuccess();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">Create Time Option</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-mono">Skill Category *</Label>
            <Select value={form.skillCategoryId} onValueChange={(v) => setForm((f) => ({ ...f, skillCategoryId: v }))}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue placeholder="Select skill…" />
              </SelectTrigger>
              <SelectContent>
                {skillCategories.map((cat) => (
                  <SelectGroup key={cat.id}>
                    <SelectLabel className="font-mono text-xs text-muted-foreground">{cat.name}</SelectLabel>
                    {(cat.children ?? []).map((child) => (
                      <SelectItem key={child.id} value={String(child.id)} className="font-mono text-sm">
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Hours *</Label>
              <Input type="number" min="1" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Full Rate ($/hr) *</Label>
              <Input type="number" min="1" step="0.01" placeholder="e.g. 150" value={form.fullRateCents} onChange={(e) => setForm((f) => ({ ...f, fullRateCents: e.target.value }))} className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Window Start *</Label>
              <Input type="date" value={form.windowStart} onChange={(e) => setForm((f) => ({ ...f, windowStart: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Window End *</Label>
              <Input type="date" value={form.windowEnd} onChange={(e) => setForm((f) => ({ ...f, windowEnd: e.target.value }))} className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Premium ($/hr, optional)</Label>
              <Input type="number" min="0.01" step="0.01" placeholder="auto-computed" value={form.premiumCents} onChange={(e) => setForm((f) => ({ ...f, premiumCents: e.target.value }))} className="font-mono text-sm" />
              <p className="text-[10px] text-muted-foreground">Default: 10% of rate × hours</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Expires At (optional)</Label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="font-mono text-sm" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="font-mono text-xs" disabled={createOpt.isPending} onClick={handleSubmit}>
            Create Option
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProposeSwapDialog({
  open, onClose, myListings, skillCategories, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  myListings: ListingDetail[];
  skillCategories: SkillCategory[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const propose = useProposeSwap();
  const [form, setForm] = useState({
    proposerListingId: "",
    proposerHours: "8",
    proposerSkillCategoryId: "",
    counterpartyId: "",
    counterpartyHours: "8",
    counterpartySkillCategoryId: "",
    note: "",
  });

  function handleSubmit() {
    const counterpartyId = Number(form.counterpartyId);
    const proposerListingId = Number(form.proposerListingId);
    const proposerHours = Number(form.proposerHours);
    const counterpartyHours = Number(form.counterpartyHours);
    const proposerSkillCategoryId = Number(form.proposerSkillCategoryId);
    const counterpartySkillCategoryId = Number(form.counterpartySkillCategoryId);
    if (!counterpartyId || !proposerListingId || proposerHours < 1 || counterpartyHours < 1 || !proposerSkillCategoryId || !counterpartySkillCategoryId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    propose.mutate(
      {
        data: {
          counterpartyId,
          proposerListingId,
          proposerHours,
          counterpartyHours,
          proposerSkillCategoryId,
          counterpartySkillCategoryId,
          ...(form.note ? { note: form.note } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Swap proposed" });
          onClose();
          onSuccess();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">Propose Time Swap</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-mono">Your Listing *</Label>
            <Select value={form.proposerListingId} onValueChange={(v) => setForm((f) => ({ ...f, proposerListingId: v }))}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue placeholder="Select your listing…" />
              </SelectTrigger>
              <SelectContent>
                {myListings.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)} className="font-mono text-sm">
                    {l.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Your Hours *</Label>
              <Input type="number" min="1" value={form.proposerHours} onChange={(e) => setForm((f) => ({ ...f, proposerHours: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Your Skill *</Label>
              <Select value={form.proposerSkillCategoryId} onValueChange={(v) => setForm((f) => ({ ...f, proposerSkillCategoryId: v }))}>
                <SelectTrigger className="font-mono text-sm">
                  <SelectValue placeholder="Skill…" />
                </SelectTrigger>
                <SelectContent>
                  {skillCategories.map((cat) => (
                    <SelectGroup key={cat.id}>
                      <SelectLabel className="font-mono text-xs text-muted-foreground">{cat.name}</SelectLabel>
                      {(cat.children ?? []).map((child) => (
                        <SelectItem key={child.id} value={String(child.id)} className="font-mono text-sm">{child.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-1">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Counterparty</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono">Counterparty User ID *</Label>
            <Input type="number" min="1" placeholder="Their user ID" value={form.counterpartyId} onChange={(e) => setForm((f) => ({ ...f, counterpartyId: e.target.value }))} className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-mono">Their Hours *</Label>
              <Input type="number" min="1" value={form.counterpartyHours} onChange={(e) => setForm((f) => ({ ...f, counterpartyHours: e.target.value }))} className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-mono">Their Skill *</Label>
              <Select value={form.counterpartySkillCategoryId} onValueChange={(v) => setForm((f) => ({ ...f, counterpartySkillCategoryId: v }))}>
                <SelectTrigger className="font-mono text-sm">
                  <SelectValue placeholder="Skill…" />
                </SelectTrigger>
                <SelectContent>
                  {skillCategories.map((cat) => (
                    <SelectGroup key={cat.id}>
                      <SelectLabel className="font-mono text-xs text-muted-foreground">{cat.name}</SelectLabel>
                      {(cat.children ?? []).map((child) => (
                        <SelectItem key={child.id} value={String(child.id)} className="font-mono text-sm">{child.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono">Note (optional)</Label>
            <Input placeholder="Why you're proposing this swap…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="font-mono text-xs" disabled={propose.isPending} onClick={handleSubmit}>
            Propose Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateBundleDialog({
  open, onClose, myListings, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  myListings: ListingDetail[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const createBundle = useCreateBundle();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalPriceDollars, setTotalPriceDollars] = useState("");
  const [items, setItems] = useState([{ listingId: "", hours: "8" }]);

  function addItem() {
    setItems((prev) => [...prev, { listingId: "", hours: "8" }]);
  }

  function updateItem(i: number, field: "listingId" | "hours", val: string) {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    const totalPriceCents = Math.round(Number(totalPriceDollars) * 100);
    if (!title.trim() || totalPriceCents < 1) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const validItems = items.filter((item) => item.listingId && Number(item.hours) >= 1);
    if (validItems.length === 0) {
      toast({ title: "Add at least one listing to the bundle", variant: "destructive" });
      return;
    }
    createBundle.mutate(
      {
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          totalPriceCents,
          items: validItems.map((item) => ({ listingId: Number(item.listingId), hours: Number(item.hours) })),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Bundle created" });
          onClose();
          onSuccess();
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">Create Bundle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-mono">Title *</Label>
            <Input placeholder="e.g. Full-Stack Dev Package" value={title} onChange={(e) => setTitle(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono">Description (optional)</Label>
            <Input placeholder="Brief description of the bundle…" value={description} onChange={(e) => setDescription(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono">Total Price ($) *</Label>
            <Input type="number" min="1" step="0.01" placeholder="e.g. 5000" value={totalPriceDollars} onChange={(e) => setTotalPriceDollars(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono">Listings *</Label>
              <Button size="sm" variant="outline" className="h-6 text-[10px] font-mono gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={item.listingId} onValueChange={(v) => updateItem(i, "listingId", v)}>
                  <SelectTrigger className="font-mono text-xs flex-1">
                    <SelectValue placeholder="Select listing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {myListings.map((l) => (
                      <SelectItem key={l.id} value={String(l.id)} className="font-mono text-xs">{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={item.hours}
                  onChange={(e) => updateItem(i, "hours", e.target.value)}
                  className="w-16 font-mono text-xs"
                  placeholder="hrs"
                />
                {items.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeItem(i)}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="font-mono text-xs" disabled={createBundle.isPending} onClick={handleSubmit}>
            Create Bundle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Derivatives() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState("secondary");
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [showProposeSwap, setShowProposeSwap] = useState(false);
  const [showCreateBundle, setShowCreateBundle] = useState(false);
  const [showListForResale, setShowListForResale] = useState(false);

  const { data: profile } = useGetMyProfile({
    query: { enabled: !!isSignedIn, queryKey: getGetMyProfileQueryKey() },
  });
  const currentUserId = profile?.id;

  const { data, isLoading, refetch } = useGetDerivativesPortfolio({
    query: { enabled: !!isSignedIn, queryKey: getGetDerivativesPortfolioQueryKey() },
  });

  const { data: skillCategories = [] } = useListSkillCategories({
    query: { enabled: !!isSignedIn, queryKey: getListSkillCategoriesQueryKey() },
  });

  const { data: myListings = [] } = useGetMyListings({
    query: { enabled: !!isSignedIn, queryKey: getGetMyListingsQueryKey() },
  });

  const { data: buyerCommitments = [] } = useGetBuyerCommitments({
    query: { enabled: !!isSignedIn, queryKey: getGetBuyerCommitmentsQueryKey() },
  });

  const pendingSwaps = data?.swaps.filter((s) => s.status === "proposed").length ?? 0;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Navbar />

      <div className="container py-6 flex-1">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Derivatives Portfolio
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your secondary listings, time options, swaps, and bundles
            </p>
          </div>
          {isSignedIn && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5" onClick={() => setShowListForResale(true)}>
                <TrendingUp className="h-3.5 w-3.5" /> List for Resale
              </Button>
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5" onClick={() => setShowCreateOption(true)}>
                <Clock className="h-3.5 w-3.5" /> New Option
              </Button>
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5" onClick={() => setShowProposeSwap(true)}>
                <ArrowLeftRight className="h-3.5 w-3.5" /> Propose Swap
              </Button>
              <Button size="sm" variant="outline" className="font-mono text-xs gap-1.5" onClick={() => setShowCreateBundle(true)}>
                <Package className="h-3.5 w-3.5" /> New Bundle
              </Button>
            </div>
          )}
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
              <StatCard label="Resale Listings" value={data?.secondaryListings.length ?? 0} icon={<TrendingUp className="h-4 w-4 text-emerald-400" />} color="text-emerald-400" />
              <StatCard label="Options" value={data?.options.length ?? 0} icon={<Clock className="h-4 w-4 text-yellow-400" />} color="text-yellow-400" />
              <StatCard label="Swaps" value={data?.swaps.length ?? 0} badge={pendingSwaps > 0 ? `${pendingSwaps} pending` : undefined} icon={<ArrowLeftRight className="h-4 w-4 text-primary" />} color="text-primary" />
              <StatCard label="Bundles" value={data?.bundles.length ?? 0} icon={<Package className="h-4 w-4 text-blue-400" />} color="text-blue-400" />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="secondary" className="font-mono text-xs gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Resale
                  {(data?.secondaryListings.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-emerald-400/20 text-emerald-400 px-1.5 text-[10px]">{data!.secondaryListings.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="options" className="font-mono text-xs gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Options
                  {(data?.options.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400/20 text-yellow-400 px-1.5 text-[10px]">{data!.options.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="swaps" className="font-mono text-xs gap-1.5">
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Swaps
                  {pendingSwaps > 0 && (
                    <span className="ml-1 rounded-full bg-yellow-400/20 text-yellow-400 px-1.5 text-[10px]">{pendingSwaps}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="bundles" className="font-mono text-xs gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Bundles
                  {(data?.bundles.length ?? 0) > 0 && (
                    <span className="ml-1 rounded-full bg-blue-400/20 text-blue-400 px-1.5 text-[10px]">{data!.bundles.length}</span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="secondary">
                <SecondaryListingsTab items={data?.secondaryListings ?? []} refetch={refetch} currentUserId={currentUserId} />
              </TabsContent>
              <TabsContent value="options">
                <OptionsTab items={data?.options ?? []} refetch={refetch} currentUserId={currentUserId} />
              </TabsContent>
              <TabsContent value="swaps">
                <SwapsTab items={data?.swaps ?? []} refetch={refetch} currentUserId={currentUserId} />
              </TabsContent>
              <TabsContent value="bundles">
                <BundlesTab items={data?.bundles ?? []} refetch={refetch} currentUserId={currentUserId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <CreateOptionDialog
        open={showCreateOption}
        onClose={() => setShowCreateOption(false)}
        skillCategories={skillCategories}
        onSuccess={refetch}
      />
      <ProposeSwapDialog
        open={showProposeSwap}
        onClose={() => setShowProposeSwap(false)}
        myListings={myListings}
        skillCategories={skillCategories}
        onSuccess={refetch}
      />
      <CreateBundleDialog
        open={showCreateBundle}
        onClose={() => setShowCreateBundle(false)}
        myListings={myListings}
        onSuccess={refetch}
      />
      <CreateResaleListingDialog
        open={showListForResale}
        onClose={() => setShowListForResale(false)}
        buyerCommitments={buyerCommitments}
        onSuccess={refetch}
      />
    </div>
  );
}
