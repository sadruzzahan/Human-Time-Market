import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfessionalCommitments,
  useGetProfessionalCashFlow,
  useGetProfessionalEarnings,
  useGetProfessionalRateHealth,
  useGetBuyerCommitments,
  useGetNotifications,
  useLogDelivery,
  useConfirmDelivery,
  useOpenDispute,
  useMarkNotificationsRead,
  getGetProfessionalCommitmentsQueryKey,
  getGetBuyerCommitmentsQueryKey,
  getGetProfessionalCashFlowQueryKey,
  getGetProfessionalEarningsQueryKey,
  getGetProfessionalRateHealthQueryKey,
  getGetNotificationsQueryKey,
  type ProfessionalCommitment,
  type BuyerCommitment,
  type DeliveryLog,
  type CashFlowWeek,
  type EarningsEntry,
  type RateHealthEntry,
  type Notification,
} from "@workspace/api-client-react";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  Calendar,
  ClipboardList,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtRate(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr`;
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtWeek(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Notification panel
// ---------------------------------------------------------------------------

function notifLabel(type: Notification["type"], payload: Record<string, unknown>): string {
  const title = String(payload.listingTitle ?? "");
  switch (type) {
    case "new_bid": return `New bid received on "${title}"`;
    case "bid_accepted": return `Your bid was accepted for "${title}"`;
    case "delivery_logged": return `Delivery logged on "${title}" — ${payload.hoursLogged}h`;
    case "delivery_confirmed": return `Delivery confirmed on "${title}"`;
    case "payment_released": return `Payment released for "${title}"`;
    case "contract_expiring": return `Contract expiring soon: "${title}"`;
    case "dispute_opened": return `Dispute opened on "${title}"`;
    case "dispute_resolved": return `Dispute resolved on "${title}"`;
    default: return type;
  }
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();

  const handleMarkAll = () => {
    markRead({ data: { ids: [] } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      },
    });
  };

  const handleMarkOne = (id: number) => {
    markRead({ data: { ids: [id] } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      },
    });
  };

  return (
    <div className="w-80 max-h-[480px] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-mono font-semibold text-sm">Notifications</span>
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleMarkAll}>Mark all read</Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.items.length ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No notifications yet</div>
        ) : (
          data.items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 ${!n.read ? "bg-primary/5" : ""}`}
            >
              {!n.read && <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />}
              {n.read && <span className="mt-1 w-2 h-2 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-snug">{notifLabel(n.type, n.payload as Record<string, unknown>)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmtTs(n.createdAt)}</p>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => handleMarkOne(n.id)}>
                  <Check className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery log dialog (professional logs hours)
// ---------------------------------------------------------------------------

function LogDeliveryDialog({
  listing,
  open,
  onClose,
}: {
  listing: ProfessionalCommitment;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const { mutate, isPending } = useLogDelivery();

  const handleSubmit = () => {
    const h = parseInt(hours, 10);
    if (!h || h < 1) { toast({ title: "Enter a valid number of hours", variant: "destructive" }); return; }
    mutate(
      { listingId: listing.id, data: { hoursLogged: h, note: note || null } },
      {
        onSuccess: () => {
          toast({ title: "Delivery logged" });
          qc.invalidateQueries({ queryKey: getGetProfessionalCommitmentsQueryKey() });
          setHours(""); setNote(""); onClose();
        },
        onError: () => toast({ title: "Failed to log delivery", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono">Log Delivered Hours</DialogTitle>
          <DialogDescription>{listing.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Hours logged</Label>
            <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 8" className="mt-1" />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was delivered?" rows={3} className="mt-1" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Logging…" : "Log Hours"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Dispute dialog
// ---------------------------------------------------------------------------

function DisputeDialog({
  listingId,
  listingTitle,
  open,
  onClose,
}: {
  listingId: number;
  listingTitle: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const { mutate, isPending } = useOpenDispute();

  const handleSubmit = () => {
    if (!reason.trim()) { toast({ title: "Please provide a reason", variant: "destructive" }); return; }
    mutate(
      { listingId, data: { reason: reason.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Dispute opened" });
          qc.invalidateQueries({ queryKey: getGetProfessionalCommitmentsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetBuyerCommitmentsQueryKey() });
          setReason(""); onClose();
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast({ title: msg ?? "Failed to open dispute", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-destructive">Open Dispute</DialogTitle>
          <DialogDescription>{listingTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">Describe the issue. Both parties will be notified and the contract will be flagged for review.</p>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describe the problem…" rows={4} className="mt-1" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="destructive" className="flex-1" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Opening…" : "Open Dispute"}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Commitment card — professional side
// ---------------------------------------------------------------------------

function ProfessionalCommitmentCard({ c }: { c: ProfessionalCommitment }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const progress = c.totalHours > 0 ? Math.round((c.hoursDelivered / c.totalHours) * 100) : 0;
  const { mutate: confirmDelivery } = useConfirmDelivery();

  const statusColor =
    c.status === "completed" ? "text-emerald-400" :
    c.dispute ? "text-red-400" : "text-amber-400";

  return (
    <>
      <LogDeliveryDialog listing={c} open={logOpen} onClose={() => setLogOpen(false)} />
      <DisputeDialog listingId={c.id} listingTitle={c.title} open={disputeOpen} onClose={() => setDisputeOpen(false)} />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono font-semibold text-sm truncate">{c.title}</h3>
                <Badge variant="outline" className={`text-xs font-mono ${statusColor}`}>
                  {c.dispute ? "DISPUTED" : c.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.skillCategoryName} · Buyer: {c.buyerDisplayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(c.startDate)} → {fmtDate(c.endDate)} · {c.hoursPerWeek}h/wk · {fmtRate(c.rateCents)}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{c.hoursDelivered}h delivered</span>
              <span>{c.totalHours}h total</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{c.hoursRemaining}h remaining</p>
          </div>

          {c.status === "committed" && !c.dispute && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs" onClick={() => setLogOpen(true)}>
                <ClipboardList className="h-3 w-3 mr-1" /> Log Hours
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/40" onClick={() => setDisputeOpen(true)}>
                <ShieldAlert className="h-3 w-3 mr-1" /> Dispute
              </Button>
            </div>
          )}

          {c.dispute && (
            <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
              <span className="font-semibold text-destructive">Dispute {c.dispute.status.replace("_", " ")}</span>
              <span className="text-muted-foreground ml-2">{c.dispute.reason}</span>
            </div>
          )}
        </div>

        {expanded && c.deliveryLogs.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivery Logs</p>
            {c.deliveryLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs">
                <div className="mt-0.5 shrink-0">
                  {log.confirmedAt
                    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    : <Clock className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{log.hoursLogged}h</span>
                  {log.note && <span className="text-muted-foreground ml-1">— {log.note}</span>}
                  <span className="text-muted-foreground ml-2">{fmtTs(log.loggedAt)}</span>
                  {log.confirmedAt && <span className="text-emerald-400 ml-2">Confirmed</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Commitment card — buyer side
// ---------------------------------------------------------------------------

function BuyerCommitmentCard({ c }: { c: BuyerCommitment }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const { mutate: confirmDelivery, isPending: isConfirming } = useConfirmDelivery();
  const progress = c.totalHours > 0 ? Math.round((c.hoursDelivered / c.totalHours) * 100) : 0;

  const handleConfirm = (deliveryId: number) => {
    confirmDelivery(
      { listingId: c.id, deliveryId },
      {
        onSuccess: () => {
          toast({ title: "Delivery confirmed" });
          qc.invalidateQueries({ queryKey: getGetBuyerCommitmentsQueryKey() });
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
          toast({ title: msg ?? "Failed to confirm", variant: "destructive" });
        },
      },
    );
  };

  const statusColor =
    c.status === "completed" ? "text-emerald-400" :
    c.dispute ? "text-red-400" : "text-amber-400";

  return (
    <>
      <DisputeDialog listingId={c.id} listingTitle={c.title} open={disputeOpen} onClose={() => setDisputeOpen(false)} />
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono font-semibold text-sm truncate">{c.title}</h3>
                <Badge variant="outline" className={`text-xs font-mono ${statusColor}`}>
                  {c.dispute ? "DISPUTED" : c.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.skillCategoryName} · Professional: {c.professionalDisplayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(c.startDate)} → {fmtDate(c.endDate)} · {c.hoursPerWeek}h/wk · {fmtRate(c.rateCents)}
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{c.hoursDelivered}h delivered</span>
              <span>{c.totalHours}h contracted</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {c.status === "committed" && !c.dispute && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/40" onClick={() => setDisputeOpen(true)}>
                <ShieldAlert className="h-3 w-3 mr-1" /> Raise Dispute
              </Button>
            </div>
          )}

          {c.dispute && (
            <div className="mt-3 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
              <span className="font-semibold text-destructive">Dispute {c.dispute.status.replace("_", " ")}</span>
              <span className="text-muted-foreground ml-2">{c.dispute.reason}</span>
            </div>
          )}
        </div>

        {expanded && c.deliveryLogs.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deliveries to confirm</p>
            {c.deliveryLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs">
                <div className="mt-0.5 shrink-0">
                  {log.confirmedAt
                    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    : <Clock className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{log.hoursLogged}h</span>
                  {log.note && <span className="text-muted-foreground ml-1">— {log.note}</span>}
                  <span className="text-muted-foreground ml-2">{fmtTs(log.loggedAt)}</span>
                </div>
                {!log.confirmedAt && (
                  <Button size="sm" className="h-6 text-xs py-0 px-2" onClick={() => handleConfirm(log.id)} disabled={isConfirming}>
                    Confirm
                  </Button>
                )}
                {log.confirmedAt && <span className="text-emerald-400">Confirmed</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Rate health panel
// ---------------------------------------------------------------------------

function RateHealthPanel() {
  const { data, isLoading } = useGetProfessionalRateHealth();

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data?.length) return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
      No active listings to compare rates against market data.
    </div>
  );

  return (
    <div className="space-y-3">
      {data.map((r: RateHealthEntry) => {
        const Icon = r.recommendation === "raise" ? TrendingUp : r.recommendation === "lower" ? TrendingDown : Minus;
        const color =
          r.recommendation === "raise" ? "text-emerald-400" :
          r.recommendation === "lower" ? "text-red-400" :
          r.recommendation === "no_data" ? "text-muted-foreground" : "text-blue-400";
        const label =
          r.recommendation === "raise" ? "Consider raising your rate" :
          r.recommendation === "lower" ? "Consider lowering to stay competitive" :
          r.recommendation === "no_data" ? "Insufficient market data" : "Rate is competitive";
        return (
          <div key={r.skillCategoryId} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
            <Icon className={`h-5 w-5 shrink-0 ${color}`} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-semibold">{r.skillCategoryName}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-bold">{fmtRate(r.myRateCents)}</p>
              {r.marketVwapCents != null && (
                <p className="text-xs text-muted-foreground">Market: {fmtRate(r.marketVwapCents)}</p>
              )}
            </div>
            {r.deltaPercent != null && (
              <Badge variant="outline" className={`text-xs ${color}`}>
                {r.deltaPercent > 0 ? "+" : ""}{r.deltaPercent.toFixed(0)}%
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cash flow chart
// ---------------------------------------------------------------------------

function CashFlowChart() {
  const { data, isLoading } = useGetProfessionalCashFlow();

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.length) return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
      No active committed contracts to project cash flow.
    </div>
  );

  const chartData = (data as CashFlowWeek[]).map((w) => ({
    week: fmtWeek(w.weekStart),
    earnings: Math.round(w.projectedCents / 100),
    contracts: w.contracts,
  }));

  const total = (data as CashFlowWeek[]).reduce((s, w) => s + w.projectedCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
        <DollarSign className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Total projected (all weeks)</p>
          <p className="font-mono font-bold text-lg">{fmtMoney(total)}</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
            <ReTooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
              formatter={(v: number) => [`$${v}`, "Projected"]}
            />
            <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Earnings history
// ---------------------------------------------------------------------------

function EarningsHistory() {
  const { data, isLoading } = useGetProfessionalEarnings();

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data?.length) return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm">
      No completed contracts yet.
    </div>
  );

  const totalEarned = (data as EarningsEntry[]).reduce((s, e) => s + e.totalEarnedCents, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
        <DollarSign className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">Total earned (all time)</p>
          <p className="font-mono font-bold text-lg">{fmtMoney(totalEarned)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {(data as EarningsEntry[]).map((e) => (
          <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-semibold truncate">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.skillCategoryName} · {e.buyerDisplayName}</p>
              <p className="text-xs text-muted-foreground">{e.hoursDelivered}h delivered · {fmtDate(e.completedAt)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-bold text-sm text-emerald-400">{fmtMoney(e.totalEarnedCents)}</p>
              <p className="text-xs text-muted-foreground">{fmtRate(e.rateCents)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"professional" | "buyer">("professional");

  const { data: notifs } = useGetNotifications();
  const { data: proCommitments, isLoading: proLoading } = useGetProfessionalCommitments();
  const { data: buyerCommitments, isLoading: buyerLoading } = useGetBuyerCommitments();

  const unread = notifs?.unreadCount ?? 0;

  const activeProContracts = (proCommitments ?? []).filter((c) => c.status === "committed");
  const completedProContracts = (proCommitments ?? []).filter((c) => c.status === "completed");
  const activeBuyerContracts = (buyerCommitments ?? []).filter((c) => c.status === "committed");
  const completedBuyerContracts = (buyerCommitments ?? []).filter((c) => c.status === "completed");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-mono font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your commitment book, earnings, and market positions</p>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2"
              onClick={() => setNotifOpen(!notifOpen)}
              data-testid="btn-notifications"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <Badge className="h-5 px-1.5 text-xs">{unread > 99 ? "99+" : unread}</Badge>
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-0 top-10 z-50 rounded-lg border border-border bg-background shadow-xl overflow-hidden">
                <NotificationPanel onClose={() => setNotifOpen(false)} />
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="professional" className="gap-2" data-testid="tab-professional">
              <ClipboardList className="h-4 w-4" />
              Professional
            </TabsTrigger>
            <TabsTrigger value="buyer" className="gap-2" data-testid="tab-buyer">
              <Calendar className="h-4 w-4" />
              Buyer
            </TabsTrigger>
          </TabsList>

          {/* ---- Professional Tab ---- */}
          <TabsContent value="professional" className="space-y-8">
            {/* Active commitments */}
            <section data-testid="section-pro-commitments">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                Active Contracts
                {activeProContracts.length > 0 && (
                  <Badge variant="secondary" className="font-mono">{activeProContracts.length}</Badge>
                )}
              </h2>
              {proLoading ? (
                <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
              ) : activeProContracts.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                  No active contracts. Book your services to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeProContracts.map((c) => <ProfessionalCommitmentCard key={c.id} c={c} />)}
                </div>
              )}
            </section>

            <Separator />

            {/* Rate Health */}
            <section data-testid="section-rate-health">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Rate Health
              </h2>
              <RateHealthPanel />
            </section>

            <Separator />

            {/* Cash flow */}
            <section data-testid="section-cash-flow">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                Projected Cash Flow
              </h2>
              <CashFlowChart />
            </section>

            <Separator />

            {/* Earnings history */}
            <section data-testid="section-earnings">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Earnings History
                {completedProContracts.length > 0 && (
                  <Badge variant="secondary" className="font-mono">{completedProContracts.length} completed</Badge>
                )}
              </h2>
              <EarningsHistory />
            </section>
          </TabsContent>

          {/* ---- Buyer Tab ---- */}
          <TabsContent value="buyer" className="space-y-8">
            {/* Active engagements */}
            <section data-testid="section-buyer-commitments">
              <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Active Engagements
                {activeBuyerContracts.length > 0 && (
                  <Badge variant="secondary" className="font-mono">{activeBuyerContracts.length}</Badge>
                )}
              </h2>
              {buyerLoading ? (
                <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
              ) : activeBuyerContracts.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground text-sm">
                  No active engagements. Browse the marketplace to book professional time.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeBuyerContracts.map((c) => <BuyerCommitmentCard key={c.id} c={c} />)}
                </div>
              )}
            </section>

            <Separator />

            {/* Completed engagements */}
            {completedBuyerContracts.length > 0 && (
              <section>
                <h2 className="font-mono text-lg font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Past Engagements
                  <Badge variant="secondary" className="font-mono">{completedBuyerContracts.length}</Badge>
                </h2>
                <div className="space-y-3">
                  {completedBuyerContracts.map((c) => <BuyerCommitmentCard key={c.id} c={c} />)}
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
