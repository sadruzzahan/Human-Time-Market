import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetListing,
  usePlaceBid,
  useBookListing,
  useAcceptBid,
  useDeleteListing,
  getListListingsQueryKey,
  getGetListingQueryKey,
  type BidDetail,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import Navbar from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Clock,
  Gavel,
  Zap,
  User,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  fixed_rate: { label: "FIXED RATE", icon: <Clock className="h-3.5 w-3.5" />, color: "text-primary border-primary/40 bg-primary/10" },
  auction: { label: "AUCTION", icon: <Gavel className="h-3.5 w-3.5" />, color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  emergency: { label: "EMERGENCY", icon: <Zap className="h-3.5 w-3.5" />, color: "text-red-400 border-red-400/40 bg-red-400/10" },
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "OPEN", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  in_bidding: { label: "IN BIDDING", color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  committed: { label: "COMMITTED", color: "text-blue-400 border-blue-400/40 bg-blue-400/10", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  completed: { label: "COMPLETED", color: "text-muted-foreground border-border bg-muted", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled: { label: "CANCELLED", color: "text-destructive border-destructive/40 bg-destructive/10", icon: <XCircle className="h-3.5 w-3.5" /> },
};

const BID_STATUS_META: Record<string, { color: string }> = {
  pending: { color: "text-yellow-400" },
  accepted: { color: "text-emerald-400" },
  rejected: { color: "text-destructive" },
  withdrawn: { color: "text-muted-foreground" },
};

function BidRow({ bid, isOwner, listingId }: { bid: BidDetail; isOwner: boolean; listingId: number }) {
  const qc = useQueryClient();
  const acceptBid = useAcceptBid({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
        qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
      },
    },
  });
  const statusMeta = BID_STATUS_META[bid.status] ?? BID_STATUS_META.pending;

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-mono font-medium text-foreground">{bid.bidderDisplayName}</span>
        <span className="text-xs font-mono text-muted-foreground">
          {new Date(bid.placedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        {bid.message && (
          <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">{bid.message}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-primary">${(bid.bidRateCents / 100).toLocaleString()}/hr</span>
        <span className={`text-xs font-mono font-semibold uppercase ${statusMeta.color}`}>{bid.status}</span>
        {isOwner && bid.status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs font-mono gap-1 text-emerald-400 border-emerald-400/40 hover:bg-emerald-400/10"
            disabled={acceptBid.isPending}
            onClick={() => acceptBid.mutate({ listingId, bidId: bid.id })}
            data-testid={`btn-accept-bid-${bid.id}`}
          >
            {acceptBid.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            ACCEPT
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ListingDetail() {
  const [, params] = useRoute("/listings/:listingId");
  const [, setLocation] = useLocation();
  const listingId = Number(params?.listingId);

  const { isSignedIn, userId: clerkUserId } = useAuth();
  const qc = useQueryClient();

  const { data: listing, isLoading, error } = useGetListing(listingId, {
    query: { queryKey: getGetListingQueryKey(listingId), enabled: !!listingId },
  });

  const [bidRateDollars, setBidRateDollars] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const placeBid = usePlaceBid({
    mutation: {
      onSuccess: () => {
        setBidDialogOpen(false);
        setBidRateDollars("");
        setBidMessage("");
        qc.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
        qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
      },
    },
  });

  const bookListing = useBookListing({
    mutation: {
      onSuccess: () => {
        setBookingSuccess(true);
        qc.invalidateQueries({ queryKey: getGetListingQueryKey(listingId) });
        qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
      },
    },
  });

  const cancelListing = useDeleteListing({
    mutation: {
      onSuccess: () => {
        setCancelDialogOpen(false);
        setLocation("/marketplace");
        qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-48 w-full" />
        </main>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-16">
            <h2 className="font-mono text-lg font-semibold text-foreground">Listing not found</h2>
            <p className="text-muted-foreground font-mono text-sm mt-2">This listing may have been removed or doesn't exist.</p>
            <Button variant="outline" className="mt-4 font-mono text-xs" onClick={() => setLocation("/marketplace")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const typeMeta = TYPE_META[listing.listingType] ?? TYPE_META.fixed_rate;
  const statusMeta = STATUS_META[listing.status] ?? STATUS_META.open;
  const isOwner = listing.professionalClerkId === clerkUserId;
  const canBid = isSignedIn && listing.listingType === "auction" && ["open", "in_bidding"].includes(listing.status) && !isOwner;
  const canBook = isSignedIn && ["fixed_rate", "emergency"].includes(listing.listingType) && listing.status === "open" && !isOwner;
  const canCancel = isOwner && ["open", "in_bidding"].includes(listing.status);

  const totalHours = listing.hoursPerWeek;
  const estWeeks = Math.round((new Date(listing.endDate).getTime() - new Date(listing.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
  const totalEstCents = listing.rateCents * totalHours * Math.max(1, estWeeks);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => setLocation("/marketplace")}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-6 transition-colors"
          data-testid="btn-back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          MARKETPLACE
        </button>

        {bookingSuccess && (
          <div className="mb-6 p-4 rounded-sm border border-emerald-400/30 bg-emerald-400/10 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-mono font-semibold text-emerald-400 text-sm">Booking confirmed!</p>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">This listing is now committed. Escrow is set to pending payment.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-1 rounded-sm border ${typeMeta.color}`}>
                  {typeMeta.icon}
                  {typeMeta.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-1 rounded-sm border ${statusMeta.color}`}>
                  {statusMeta.icon}
                  {statusMeta.label}
                </span>
              </div>
              <h1 className="text-2xl font-mono font-bold text-foreground leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  {listing.skillCategoryParentName ? `${listing.skillCategoryParentName} › ` : ""}
                  {listing.skillCategoryName}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground capitalize">
                  {listing.professionalExperienceLevel}
                </Badge>
              </div>
            </div>

            {listing.description && (
              <div>
                <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-2">Description</h2>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{listing.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-mono uppercase">Asking Rate</span>
                </div>
                <p className="font-mono font-bold text-primary text-lg">${(listing.rateCents / 100).toLocaleString()}/hr</p>
              </div>
              <div className="bg-card border border-border rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-mono uppercase">Availability</span>
                </div>
                <p className="font-mono font-semibold text-foreground">{listing.hoursPerWeek}h/wk</p>
              </div>
              <div className="bg-card border border-border rounded-sm p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-mono uppercase">Duration</span>
                </div>
                <p className="font-mono text-xs text-foreground">
                  {new Date(listing.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                  {new Date(listing.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>

            {listing.listingType === "auction" && listing.bids.length > 0 && (
              <div>
                <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
                  Bids ({listing.bids.length})
                </h2>
                <div className="bg-card border border-border rounded-sm px-4">
                  {listing.bids.map((bid) => (
                    <BidRow
                      key={bid.id}
                      bid={bid}
                      isOwner={isOwner}
                      listingId={listingId}
                    />
                  ))}
                </div>
              </div>
            )}

            {listing.escrow && (
              <div className="p-4 rounded-sm border border-blue-400/30 bg-blue-400/5">
                <h2 className="font-mono text-xs font-semibold text-blue-400 uppercase mb-2">Escrow Record</h2>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Amount: </span>
                    <span className="text-foreground">${(listing.escrow.amountCents / 100).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="text-blue-400 uppercase">{listing.escrow.status.replace("_", " ")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-card border border-border rounded-sm p-4">
              <h2 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">Professional</h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-mono font-semibold text-sm text-foreground">{listing.professionalDisplayName}</p>
                  {listing.professionalTimezone && (
                    <p className="text-xs font-mono text-muted-foreground">{listing.professionalTimezone}</p>
                  )}
                </div>
              </div>
              {listing.professionalBio && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{listing.professionalBio}</p>
              )}

              <Separator className="my-3" />

              <div className="text-xs font-mono text-muted-foreground">
                <div className="flex justify-between mb-1">
                  <span>Est. contract value</span>
                  <span className="text-foreground">${(totalEstCents / 100).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span className="text-foreground">~{estWeeks > 0 ? estWeeks : 1} wk{estWeeks !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>

            {(canBid || canBook || canCancel) && (
              <div className="space-y-2">
                {canBook && (
                  <Button
                    className="w-full font-mono text-sm gap-2"
                    disabled={bookListing.isPending || bookingSuccess}
                    onClick={() => bookListing.mutate({ listingId })}
                    data-testid="btn-book-listing"
                  >
                    {bookListing.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    BOOK NOW
                  </Button>
                )}

                {canBid && (
                  <Button
                    className="w-full font-mono text-sm gap-2"
                    variant="outline"
                    onClick={() => setBidDialogOpen(true)}
                    data-testid="btn-place-bid"
                  >
                    <Gavel className="h-4 w-4" />
                    PLACE BID
                  </Button>
                )}

                {canCancel && (
                  <Button
                    variant="outline"
                    className="w-full font-mono text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => setCancelDialogOpen(true)}
                    data-testid="btn-cancel-listing"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    CANCEL LISTING
                  </Button>
                )}
              </div>
            )}

            {!isSignedIn && listing.status === "open" && (
              <div className="text-center p-4 bg-card border border-border rounded-sm">
                <p className="text-xs font-mono text-muted-foreground mb-3">Sign in to bid or book this listing</p>
                <Button size="sm" variant="default" className="font-mono text-xs w-full" asChild>
                  <a href="/sign-in">ACCESS TERMINAL</a>
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">Place Bid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1.5">Your Rate ($/hr)</label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 150"
                value={bidRateDollars}
                onChange={(e) => setBidRateDollars(e.target.value)}
                className="font-mono"
                data-testid="input-bid-rate"
              />
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                Asking rate: ${(listing.rateCents / 100).toLocaleString()}/hr
              </p>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1.5">Message (optional)</label>
              <Textarea
                placeholder="Why are you the right fit?"
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                className="font-mono text-sm resize-none"
                rows={3}
                data-testid="input-bid-message"
              />
            </div>
            {placeBid.error && (
              <p className="text-xs text-destructive font-mono">Failed to place bid. Please try again.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)} className="font-mono text-xs">
              CANCEL
            </Button>
            <Button
              disabled={!bidRateDollars || placeBid.isPending}
              onClick={() => {
                placeBid.mutate({
                  listingId,
                  data: {
                    bidRateCents: Math.round(parseFloat(bidRateDollars) * 100),
                    message: bidMessage || undefined,
                  },
                });
              }}
              className="font-mono text-xs gap-1.5"
              data-testid="btn-submit-bid"
            >
              {placeBid.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />}
              SUBMIT BID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono text-sm">Cancel listing?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              This will cancel your listing and reject all pending bids. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">Keep Listing</AlertDialogCancel>
            <AlertDialogAction
              className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelListing.mutate({ listingId })}
              data-testid="btn-confirm-cancel"
            >
              {cancelListing.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Cancel Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
