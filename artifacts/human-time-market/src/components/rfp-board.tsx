import { useState } from "react";
import { useListRfps, useListSkillCategories, type RfpSummary } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Calendar, DollarSign, Clock, Users } from "lucide-react";
import RfpDetailSheet from "@/components/rfp-detail-sheet";

const PAGE_SIZE = 12;

interface Props {
  onCreateRfp: () => void;
}

function RfpCard({ rfp, onClick }: { rfp: RfpSummary; onClick: () => void }) {
  const budgetMin = `$${(rfp.budgetMinCents / 100).toLocaleString()}`;
  const budgetMax = `$${(rfp.budgetMaxCents / 100).toLocaleString()}`;
  const deadline = rfp.deadline
    ? new Date(rfp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <button
      onClick={onClick}
      className="group w-full text-left flex flex-col bg-card border border-border rounded-sm p-4 hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer h-full"
      data-testid={`rfp-card-${rfp.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
          {rfp.skillCategoryParentName ? `${rfp.skillCategoryParentName} › ` : ""}
          {rfp.skillCategoryName}
        </Badge>
        <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase">{rfp.status}</span>
      </div>

      <h3 className="font-mono font-semibold text-sm text-foreground leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {rfp.title}
      </h3>

      <div className="mt-auto space-y-1.5 text-xs font-mono text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            Budget
          </span>
          <span className="text-foreground">{budgetMin} – {budgetMax}/hr</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Hours
          </span>
          <span className="text-foreground">{rfp.hoursNeeded}h total</span>
        </div>
        {deadline && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Deadline
            </span>
            <span className="text-foreground">{deadline}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span>{rfp.buyerDisplayName}</span>
          <span className="text-primary">{rfp.responseCount ?? 0} response{(rfp.responseCount ?? 0) !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </button>
  );
}

function RfpCardSkeleton() {
  return (
    <div className="flex flex-col bg-card border border-border rounded-sm p-4 h-[200px]">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-auto" />
      <div className="space-y-1.5 mt-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

export default function RfpBoard({ onCreateRfp }: Props) {
  const { isSignedIn } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState("open");
  const [page, setPage] = useState(0);
  const [selectedRfpId, setSelectedRfpId] = useState<number | null>(null);

  const { data: categories } = useListSkillCategories();

  const { data: rfpsPage, isLoading } = useListRfps({
    skillCategoryId: selectedCategory,
    status: selectedStatus as "open" | "closed" | "fulfilled",
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const rfps = rfpsPage?.items ?? [];
  const total = rfpsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const parentCategories = categories?.filter((c) => !c.parentId) ?? [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Select
          value={selectedStatus}
          onValueChange={(v) => { setSelectedStatus(v); setPage(0); }}
        >
          <SelectTrigger className="w-28 h-8 font-mono text-xs bg-card" data-testid="select-rfp-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="font-mono text-xs">
            <SelectItem value="open">OPEN</SelectItem>
            <SelectItem value="fulfilled">FULFILLED</SelectItem>
            <SelectItem value="closed">CLOSED</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 flex-wrap flex-1">
          <button
            onClick={() => { setSelectedCategory(undefined); setPage(0); }}
            className={`font-mono text-[10px] px-2 py-1 rounded-sm border transition-colors ${
              !selectedCategory
                ? "bg-primary/20 border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            ALL
          </button>
          {parentCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(selectedCategory === cat.id ? undefined : cat.id); setPage(0); }}
              className={`font-mono text-[10px] px-2 py-1 rounded-sm border transition-colors ${
                selectedCategory === cat.id
                  ? "bg-primary/20 border-primary text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {cat.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <RfpCardSkeleton key={i} />)}
        </div>
      ) : rfps.length === 0 ? (
        <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-sm bg-card/50">
          <div className="text-center">
            <div className="inline-flex p-3 rounded-full bg-muted mb-4">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-mono font-semibold text-foreground">No RFPs posted</h2>
            <p className="text-xs text-muted-foreground mt-2 font-mono max-w-xs mx-auto">
              {isSignedIn ? "Post an RFP to find professionals for your project." : "Sign in to post a request for professionals."}
            </p>
            {isSignedIn && (
              <Button
                size="sm"
                variant="outline"
                className="mt-4 font-mono text-xs gap-1.5"
                onClick={onCreateRfp}
              >
                <Plus className="h-3.5 w-3.5" />
                POST RFP
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {rfps.map((rfp) => (
              <RfpCard key={rfp.id} rfp={rfp} onClick={() => setSelectedRfpId(rfp.id)} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6 font-mono text-xs text-muted-foreground">
              <span>{total} RFP{total !== 1 ? "s" : ""} total</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <RfpDetailSheet
        rfpId={selectedRfpId}
        onClose={() => setSelectedRfpId(null)}
      />
    </div>
  );
}
