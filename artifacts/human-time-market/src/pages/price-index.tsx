import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/react";
import {
  useGetPriceIndex,
  useGetOrderBook,
  getGetOrderBookQueryKey,
  useGetPriceHistory,
  getGetPriceHistoryQueryKey,
  usePlaceOrder,
  useListSkillCategories,
  type PriceIndexEntry,
  type OrderBookDepth,
  type PriceHistoryPoint,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRate(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/hr`;
}

function formatChange(cents: number | null | undefined): {
  label: string;
  color: string;
  Icon: React.ElementType;
} {
  if (cents == null) return { label: "—", color: "text-muted-foreground", Icon: Minus };
  if (cents > 0)
    return {
      label: `+$${(cents / 100).toFixed(0)}`,
      color: "text-emerald-400",
      Icon: TrendingUp,
    };
  if (cents < 0)
    return {
      label: `-$${(Math.abs(cents) / 100).toFixed(0)}`,
      color: "text-red-400",
      Icon: TrendingDown,
    };
  return { label: "—", color: "text-muted-foreground", Icon: Minus };
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

function Sparkline({ data }: { data: PriceHistoryPoint[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="w-24 h-8 flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground font-mono">no data</span>
      </div>
    );
  }
  const first = data[0].vwapCents;
  const last = data[data.length - 1].vwapCents;
  const color = last >= first ? "#34d399" : "#f87171";

  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="vwapCents"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order Book Depth view
// ---------------------------------------------------------------------------

function OrderBookView({
  depth,
  isLoading,
}: {
  depth: OrderBookDepth | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 p-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (!depth) return null;

  const maxCum =
    Math.max(
      depth.bids[depth.bids.length - 1]?.cumulativeHours ?? 0,
      depth.asks[depth.asks.length - 1]?.cumulativeHours ?? 0,
    ) || 1;

  return (
    <div className="grid grid-cols-2 gap-0 text-xs font-mono border-t border-border">
      {/* Bids */}
      <div className="border-r border-border">
        <div className="grid grid-cols-3 bg-muted/50 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border">
          <span>PRICE</span>
          <span className="text-right">QTY (hrs)</span>
          <span className="text-right">CUM</span>
        </div>
        {depth.bids.length === 0 ? (
          <div className="px-3 py-4 text-center text-muted-foreground text-[11px]">
            No bids
          </div>
        ) : (
          depth.bids.map((level, i) => {
            const pct = (level.cumulativeHours / maxCum) * 100;
            return (
              <div
                key={i}
                className="relative grid grid-cols-3 px-3 py-1 hover:bg-muted/20"
                data-testid={`bid-level-${i}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-400/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative text-emerald-400 font-semibold">
                  {formatRate(level.rateCents)}
                </span>
                <span className="relative text-right text-foreground">{level.totalHours}h</span>
                <span className="relative text-right text-muted-foreground">
                  {level.cumulativeHours}h
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Asks */}
      <div>
        <div className="grid grid-cols-3 bg-muted/50 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border">
          <span>PRICE</span>
          <span className="text-right">QTY (hrs)</span>
          <span className="text-right">CUM</span>
        </div>
        {depth.asks.length === 0 ? (
          <div className="px-3 py-4 text-center text-muted-foreground text-[11px]">
            No asks
          </div>
        ) : (
          depth.asks.map((level, i) => {
            const pct = (level.cumulativeHours / maxCum) * 100;
            return (
              <div
                key={i}
                className="relative grid grid-cols-3 px-3 py-1 hover:bg-muted/20"
                data-testid={`ask-level-${i}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-red-400/10"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative text-red-400 font-semibold">
                  {formatRate(level.rateCents)}
                </span>
                <span className="relative text-right text-foreground">{level.totalHours}h</span>
                <span className="relative text-right text-muted-foreground">
                  {level.cumulativeHours}h
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Spread bar */}
      {depth.spread !== null && depth.bestBid !== null && depth.bestAsk !== null && (
        <div className="col-span-2 border-t border-border bg-muted/30 px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            BEST BID {formatRate(depth.bestBid)}
          </span>
          <span className="text-[10px] font-semibold text-yellow-400">
            SPREAD {formatRate(depth.spread)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            BEST ASK {formatRate(depth.bestAsk)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Place Order Dialog
// ---------------------------------------------------------------------------

function PlaceOrderDialog({
  open,
  onOpenChange,
  selectedCategory,
  categories,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCategory: number | null;
  categories: { id: number; name: string; parentName: string | null }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [orderType, setOrderType] = useState<"bid" | "ask">("bid");
  const [catId, setCatId] = useState<string>(
    selectedCategory ? String(selectedCategory) : "",
  );
  const [rate, setRate] = useState("");
  const [qty, setQty] = useState("");

  useEffect(() => {
    if (selectedCategory) setCatId(String(selectedCategory));
  }, [selectedCategory]);

  const { mutate: placeOrder, isPending } = usePlaceOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order placed", description: "Your order is live in the book." });
        qc.invalidateQueries({ queryKey: ["/api/order-book"] });
        qc.invalidateQueries({ queryKey: ["/api/price-index"] });
        onOpenChange(false);
        setRate("");
        setQty("");
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to place order";
        toast({ title: "Error", description: msg, variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const skillCategoryId = parseInt(catId, 10);
    const rateCents = Math.round(parseFloat(rate) * 100);
    const quantityHours = parseInt(qty, 10);
    if (!skillCategoryId || isNaN(rateCents) || isNaN(quantityHours)) return;
    placeOrder({
      data: { orderType, skillCategoryId, rateCents, quantityHours },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" aria-describedby="place-order-desc">
        <DialogHeader>
          <DialogTitle className="font-mono">Place Order</DialogTitle>
          <DialogDescription id="place-order-desc" className="font-mono text-xs">
            Enter the order details below
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={orderType === "bid" ? "default" : "outline"}
              className="font-mono text-xs"
              onClick={() => setOrderType("bid")}
              data-testid="btn-order-type-bid"
            >
              BID (BUY)
            </Button>
            <Button
              type="button"
              variant={orderType === "ask" ? "default" : "outline"}
              className="font-mono text-xs"
              onClick={() => setOrderType("ask")}
              data-testid="btn-order-type-ask"
            >
              ASK (SELL)
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono text-xs">Skill Category</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger
                className="font-mono text-xs bg-card"
                data-testid="select-order-category"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="font-mono text-xs">
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.parentName ? `${c.parentName} › ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Rate ($/hr)</Label>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="font-mono text-xs bg-card"
                placeholder="150.00"
                data-testid="input-order-rate"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Quantity (hrs)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="font-mono text-xs bg-card"
                placeholder="40"
                data-testid="input-order-qty"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full font-mono text-xs"
            data-testid="btn-submit-order"
          >
            {isPending
              ? "Placing..."
              : orderType === "bid"
              ? "PLACE BID ORDER"
              : "PLACE ASK ORDER"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Row in the price index table
// ---------------------------------------------------------------------------

function PriceIndexRow({
  entry,
  history,
  historyLoading,
  isSelected,
  onSelect,
  orderBookDepth,
  orderBookLoading,
  onPlaceOrder,
}: {
  entry: PriceIndexEntry;
  history: PriceHistoryPoint[] | undefined;
  historyLoading: boolean;
  isSelected: boolean;
  onSelect: () => void;
  orderBookDepth: OrderBookDepth | undefined;
  orderBookLoading: boolean;
  onPlaceOrder: () => void;
}) {
  const change = formatChange(entry.change24hCents);
  const ChangeIcon = change.Icon;

  return (
    <>
      <div
        className={`grid grid-cols-12 items-center px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border ${isSelected ? "bg-muted/40" : ""}`}
        onClick={onSelect}
        data-testid={`price-index-row-${entry.skillCategoryId}`}
      >
        {/* Category */}
        <div className="col-span-4 md:col-span-3">
          <div className="text-sm font-mono font-medium text-foreground truncate">
            {entry.skillCategoryName}
          </div>
          {entry.parentName && (
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              {entry.parentName}
            </div>
          )}
        </div>

        {/* VWAP */}
        <div className="col-span-3 text-right">
          <span className="text-sm font-mono font-semibold text-primary">
            {formatRate(entry.vwapCents)}
          </span>
        </div>

        {/* 24h change */}
        <div className={`col-span-2 text-right flex items-center justify-end gap-1 ${change.color}`}>
          <ChangeIcon className="h-3 w-3 shrink-0" />
          <span className="text-xs font-mono font-medium">{change.label}</span>
        </div>

        {/* Volume */}
        <div className="col-span-2 text-right text-xs font-mono text-muted-foreground">
          {entry.volumeHours24h > 0 ? `${entry.volumeHours24h}h` : "—"}
        </div>

        {/* Sparkline */}
        <div className="col-span-1 md:col-span-2 flex items-center justify-end gap-2">
          {historyLoading ? (
            <Skeleton className="w-24 h-8" />
          ) : (
            <Sparkline data={history ?? []} />
          )}
          <span className="hidden md:block">
            {isSelected ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        </div>
      </div>

      {/* Expanded order book */}
      {isSelected && (
        <div
          className="border-b border-border bg-card/60"
          data-testid={`order-book-panel-${entry.skillCategoryId}`}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                ORDER BOOK — {entry.skillCategoryName}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs h-7 gap-1"
              onClick={onPlaceOrder}
              data-testid="btn-place-order-inline"
            >
              <Plus className="h-3 w-3" />
              PLACE ORDER
            </Button>
          </div>
          <OrderBookView depth={orderBookDepth} isLoading={orderBookLoading} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Container for a single row that fetches its own history + order book
// ---------------------------------------------------------------------------

function PriceIndexRowContainer({
  entry,
  isSelected,
  onSelect,
  onPlaceOrder,
}: {
  entry: PriceIndexEntry;
  isSelected: boolean;
  onSelect: () => void;
  onPlaceOrder: () => void;
}) {
  const qc = useQueryClient();

  const { data: history, isLoading: historyLoading } = useGetPriceHistory(
    entry.skillCategoryId,
    {
      query: {
        queryKey: getGetPriceHistoryQueryKey(entry.skillCategoryId),
        enabled: true,
      },
    },
  );

  const { data: orderBook, isLoading: orderBookLoading } = useGetOrderBook(
    entry.skillCategoryId,
    {
      query: {
        queryKey: getGetOrderBookQueryKey(entry.skillCategoryId),
        enabled: isSelected,
      },
    },
  );

  // Per-category SSE: subscribe when row is expanded for live order book depth
  useEffect(() => {
    if (!isSelected) return;
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${window.location.origin}${base}/api/order-book/${entry.skillCategoryId}/events`;
    const evtSource = new EventSource(url, { withCredentials: true });
    evtSource.addEventListener("order-book", () => {
      qc.invalidateQueries({ queryKey: getGetOrderBookQueryKey(entry.skillCategoryId) });
    });
    return () => evtSource.close();
  }, [isSelected, entry.skillCategoryId, qc]);

  return (
    <PriceIndexRow
      entry={entry}
      history={history}
      historyLoading={historyLoading}
      isSelected={isSelected}
      onSelect={onSelect}
      orderBookDepth={orderBook}
      orderBookLoading={orderBookLoading}
      onPlaceOrder={onPlaceOrder}
    />
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PriceIndex() {
  const { isSignedIn } = useAuth();
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [placeOrderOpen, setPlaceOrderOpen] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );

  const { data: priceIndex, isLoading, refetch } = useGetPriceIndex();
  const { data: categories } = useListSkillCategories();

  const qc = useQueryClient();

  // Flatten child categories for the place order dropdown
  const leafCategories = (categories ?? []).flatMap((cat) =>
    cat.children.map((child) => ({
      id: child.id,
      name: child.name,
      parentName: cat.name,
    })),
  );

  // SSE connection for live price-index updates
  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const url = `${window.location.origin}${base}/api/price-index/events`;
    const evtSource = new EventSource(url, { withCredentials: true });

    evtSource.onopen = () => setLiveStatus("live");
    evtSource.onerror = () => setLiveStatus("offline");

    evtSource.addEventListener("price-index", () => {
      refetch();
    });

    return () => evtSource.close();
  }, [refetch]);

  const handleRowSelect = useCallback(
    (catId: number) => {
      setSelectedCatId((prev) => (prev === catId ? null : catId));
    },
    [],
  );

  const handlePlaceOrder = useCallback((catId?: number) => {
    if (catId) setSelectedCatId(catId);
    setPlaceOrderOpen(true);
  }, []);

  // Group entries by parent for display
  const grouped = (priceIndex ?? []).reduce<Record<string, PriceIndexEntry[]>>(
    (acc, entry) => {
      const key = entry.parentName ?? "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">
              TIME PRICE INDEX
            </h1>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              Real-time market-clearing rates across all skill categories
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground font-mono">MARKET STATUS</p>
              <p className="text-sm font-mono font-medium flex items-center justify-end gap-2">
                <span className="relative flex h-2 w-2">
                  {liveStatus === "live" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </>
                  ) : liveStatus === "connecting" ? (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-400" />
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                  )}
                </span>
                <span
                  className={
                    liveStatus === "live"
                      ? "text-primary"
                      : liveStatus === "connecting"
                      ? "text-yellow-400"
                      : "text-red-400"
                  }
                >
                  {liveStatus === "live"
                    ? "LIVE"
                    : liveStatus === "connecting"
                    ? "CONNECTING"
                    : "OFFLINE"}
                </span>
              </p>
            </div>
            {isSignedIn && (
              <Button
                size="sm"
                onClick={() => handlePlaceOrder(selectedCatId ?? undefined)}
                className="font-mono text-xs gap-1.5"
                data-testid="btn-place-order-header"
              >
                <Activity className="h-3.5 w-3.5" />
                PLACE ORDER
              </Button>
            )}
          </div>
        </div>

        {/* Price index table */}
        {isLoading ? (
          <div className="border border-border rounded-sm overflow-hidden bg-card">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3 border-b border-border">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : !priceIndex || priceIndex.length === 0 ? (
          <div className="border border-border rounded-sm bg-card p-12 text-center">
            <p className="text-muted-foreground font-mono text-sm">
              No market data yet. Be the first to place an order.
            </p>
            {isSignedIn && (
              <Button
                className="mt-4 font-mono text-xs gap-1.5"
                onClick={() => setPlaceOrderOpen(true)}
                data-testid="btn-place-first-order"
              >
                <Plus className="h-3.5 w-3.5" />
                PLACE FIRST ORDER
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([parentName, entries]) => (
              <div
                key={parentName}
                className="border border-border rounded-sm overflow-hidden bg-card"
              >
                {/* Section header */}
                <div className="bg-muted/60 px-4 py-2 border-b border-border">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-widest">
                    {parentName.toUpperCase()}
                  </span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-12 px-4 py-2 bg-muted/30 border-b border-border text-[10px] font-mono font-bold text-muted-foreground">
                  <div className="col-span-4 md:col-span-3">SKILL</div>
                  <div className="col-span-3 text-right">VWAP (24H)</div>
                  <div className="col-span-2 text-right">CHG</div>
                  <div className="col-span-2 text-right">VOL (HRS)</div>
                  <div className="col-span-1 md:col-span-2 text-right">CHART</div>
                </div>

                {entries.map((entry) => (
                  <PriceIndexRowContainer
                    key={entry.skillCategoryId}
                    entry={entry}
                    isSelected={selectedCatId === entry.skillCategoryId}
                    onSelect={() => handleRowSelect(entry.skillCategoryId)}
                    onPlaceOrder={() => handlePlaceOrder(entry.skillCategoryId)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-[10px] font-mono text-muted-foreground">
          <span>
            <span className="text-emerald-400 font-semibold">BID</span> — buyer offers to pay this
            rate
          </span>
          <span>
            <span className="text-red-400 font-semibold">ASK</span> — seller offers time at this
            rate
          </span>
          <span>VWAP = volume-weighted average price of matched trades (last 24h)</span>
          <span>Click any row to view the live order book depth</span>
        </div>
      </main>

      {/* Place Order Dialog */}
      <PlaceOrderDialog
        open={placeOrderOpen}
        onOpenChange={setPlaceOrderOpen}
        selectedCategory={selectedCatId}
        categories={leafCategories}
      />
    </div>
  );
}
