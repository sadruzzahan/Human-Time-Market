import { useState } from "react";
import { useGetRfp, useRespondToRfp, getListRfpsQueryKey, getGetRfpQueryKey, getGetRfpQueryOptions } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar, Clock, DollarSign, User, Loader2, CheckCircle2, MessageSquarePlus } from "lucide-react";

interface Props {
  rfpId: number | null;
  onClose: () => void;
}

export default function RfpDetailSheet({ rfpId, onClose }: Props) {
  const { isSignedIn, userId: clerkUserId } = useAuth();
  const qc = useQueryClient();

  const { data: rfp, isLoading } = useGetRfp(rfpId!, {
    query: { queryKey: getGetRfpQueryKey(rfpId!), enabled: !!rfpId },
  });

  const [respondOpen, setRespondOpen] = useState(false);
  const [proposedRate, setProposedRate] = useState("");
  const [message, setMessage] = useState("");

  const respond = useRespondToRfp({
    mutation: {
      onSuccess: () => {
        setRespondOpen(false);
        setProposedRate("");
        setMessage("");
        qc.invalidateQueries({ queryKey: getGetRfpQueryKey(rfpId!) });
        qc.invalidateQueries({ queryKey: getListRfpsQueryKey() });
      },
    },
  });

  const isOwner = !!rfp && !!clerkUserId && rfp.buyerClerkId === clerkUserId;
  const alreadyResponded = rfp?.responses.some((r) => r.professionalClerkId === clerkUserId);
  const canRespond = isSignedIn && rfp?.status === "open" && !alreadyResponded && !isOwner;

  return (
    <>
      <Sheet open={!!rfpId} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : rfp ? (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                    {rfp.skillCategoryParentName ? `${rfp.skillCategoryParentName} › ` : ""}
                    {rfp.skillCategoryName}
                  </Badge>
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase">{rfp.status}</span>
                </div>
                <SheetTitle className="font-mono text-base font-bold text-left leading-tight">
                  {rfp.title}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5">
                <p className="text-sm text-foreground leading-relaxed">{rfp.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-card border border-border rounded-sm p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-mono uppercase">Budget</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
                      ${(rfp.budgetMinCents / 100).toLocaleString()} – ${(rfp.budgetMaxCents / 100).toLocaleString()}/hr
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-sm p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-mono uppercase">Hours</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">{rfp.hoursNeeded}h total</p>
                  </div>
                  <div className="bg-card border border-border rounded-sm p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-mono uppercase">Deadline</span>
                    </div>
                    <p className="font-mono text-xs text-foreground">
                      {rfp.deadline
                        ? new Date(rfp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-sm p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <User className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-mono uppercase">Posted by</span>
                    </div>
                    <p className="font-mono text-xs text-foreground truncate">{rfp.buyerDisplayName}</p>
                  </div>
                </div>

                {canRespond && (
                  <Button
                    className="w-full font-mono text-xs gap-1.5"
                    onClick={() => setRespondOpen(true)}
                    data-testid="btn-respond-rfp"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    SUBMIT PROPOSAL
                  </Button>
                )}

                {alreadyResponded && (
                  <div className="p-3 rounded-sm border border-emerald-400/30 bg-emerald-400/5 text-xs font-mono text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />
                    You've already submitted a proposal for this RFP.
                  </div>
                )}

                {!isSignedIn && rfp.status === "open" && (
                  <div className="p-3 rounded-sm border border-border text-xs font-mono text-muted-foreground text-center">
                    Sign in to submit a proposal
                  </div>
                )}

                {rfp.responses.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
                        Proposals ({rfp.responses.length})
                      </h3>
                      <div className="space-y-3">
                        {rfp.responses.map((r) => (
                          <div key={r.id} className="bg-card border border-border rounded-sm p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-sm font-medium text-foreground">{r.professionalDisplayName}</span>
                              <span className="font-mono font-bold text-primary text-sm">${(r.proposedRateCents / 100).toLocaleString()}/hr</span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{r.message}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <span className={`text-[10px] font-mono font-semibold uppercase ${
                                r.status === "accepted" ? "text-emerald-400" :
                                r.status === "rejected" ? "text-destructive" :
                                "text-yellow-400"
                              }`}>
                                {r.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm font-semibold">Submit Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="font-mono text-xs">Proposed Rate ($/hr) *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 175"
                value={proposedRate}
                onChange={(e) => setProposedRate(e.target.value)}
                className="font-mono mt-1.5"
                data-testid="input-proposal-rate"
              />
              {rfp && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Budget: ${(rfp.budgetMinCents / 100).toLocaleString()} – ${(rfp.budgetMaxCents / 100).toLocaleString()}/hr
                </p>
              )}
            </div>
            <div>
              <Label className="font-mono text-xs">Message *</Label>
              <Textarea
                placeholder="Describe your relevant experience and why you're a good fit..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="font-mono text-sm resize-none mt-1.5"
                rows={4}
                data-testid="input-proposal-message"
              />
            </div>
            {respond.error && (
              <p className="text-xs text-destructive font-mono">Failed to submit. Please try again.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondOpen(false)} className="font-mono text-xs">
              CANCEL
            </Button>
            <Button
              disabled={!proposedRate || !message || respond.isPending}
              onClick={() => {
                respond.mutate({
                  rfpId: rfpId!,
                  data: {
                    proposedRateCents: Math.round(parseFloat(proposedRate) * 100),
                    message,
                  },
                });
              }}
              className="font-mono text-xs gap-1.5"
              data-testid="btn-submit-proposal"
            >
              {respond.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              SUBMIT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
