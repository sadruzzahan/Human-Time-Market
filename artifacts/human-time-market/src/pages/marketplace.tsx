import { useState, useCallback } from "react";
import { Link } from "wouter";
import { useListListings, useListSkillCategories, ListingType, ListingStatus, type ListingSummary } from "@workspace/api-client-react";
import { useAuth } from "@clerk/react";
import Navbar from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  SlidersHorizontal,
  Plus,
  Clock,
  TrendingUp,
  Zap,
  Gavel,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Users,
} from "lucide-react";
import CreateListingSheet from "@/components/create-listing-sheet";
import CreateRfpSheet from "@/components/create-rfp-sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RfpBoard from "@/components/rfp-board";

const PAGE_SIZE = 12;

const LISTING_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  fixed_rate: { label: "FIXED RATE", icon: <Clock className="h-3 w-3" />, color: "text-primary border-primary/40 bg-primary/10" },
  auction: { label: "AUCTION", icon: <Gavel className="h-3 w-3" />, color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  emergency: { label: "EMERGENCY", icon: <Zap className="h-3 w-3" />, color: "text-red-400 border-red-400/40 bg-red-400/10" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "OPEN", color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
  in_bidding: { label: "BIDDING", color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  committed: { label: "COMMITTED", color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
  completed: { label: "COMPLETED", color: "text-muted-foreground border-border bg-muted" },
  cancelled: { label: "CANCELLED", color: "text-destructive border-destructive/40 bg-destructive/10" },
};

function ListingCard({ listing }: { listing: ListingSummary }) {
  const typeInfo = LISTING_TYPE_LABELS[listing.listingType] ?? LISTING_TYPE_LABELS.fixed_rate;
  const statusInfo = STATUS_LABELS[listing.status] ?? STATUS_LABELS.open;
  const rateDisplay = `$${(listing.rateCents / 100).toLocaleString()}/hr`;

  return (
    <Link href={`/listings/${listing.id}`} data-testid={`listing-card-${listing.id}`}>
      <div className="group relative flex flex-col bg-card border border-border rounded-sm p-4 hover:border-primary/50 hover:bg-card/80 transition-all cursor-pointer h-full">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border ${typeInfo.color}`}>
              {typeInfo.icon}
              {typeInfo.label}
            </span>
            <span className={`inline-flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <span className="text-lg font-mono font-bold text-primary whitespace-nowrap">{rateDisplay}</span>
        </div>

        <h3 className="font-mono font-semibold text-sm text-foreground leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            {listing.skillCategoryParentName ? `${listing.skillCategoryParentName} › ` : ""}
            {listing.skillCategoryName}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground capitalize">
            {listing.professionalExperienceLevel}
          </Badge>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>{listing.hoursPerWeek}h/wk</span>
            <span className="truncate max-w-[120px]">{listing.professionalDisplayName}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>{new Date(listing.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(listing.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            {listing.listingType === "auction" && (
              <span className="text-yellow-400">{listing.bidCount ?? 0} bid{(listing.bidCount ?? 0) !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left rounded-b-sm" />
      </div>
    </Link>
  );
}

function ListingCardSkeleton() {
  return (
    <div className="flex flex-col bg-card border border-border rounded-sm p-4 h-[180px]">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-3" />
      <Skeleton className="h-4 w-24 mb-auto" />
      <div className="flex justify-between mt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export default function Marketplace() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState("listings");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string>("open");
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [createRfpOpen, setCreateRfpOpen] = useState(false);

  const { data: categories } = useListSkillCategories();

  const params = {
    skillCategoryId: selectedCategory,
    listingType: selectedType as typeof ListingType[keyof typeof ListingType] | undefined,
    status: selectedStatus as typeof ListingStatus[keyof typeof ListingStatus],
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data: listingsPage, isLoading } = useListListings(params);
  const listings = listingsPage?.items ?? [];
  const total = listingsPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filtered = search.trim()
    ? listings.filter((l) =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.professionalDisplayName.toLowerCase().includes(search.toLowerCase()) ||
        l.skillCategoryName.toLowerCase().includes(search.toLowerCase())
      )
    : listings;

  const handleCategorySelect = useCallback((id: number | undefined) => {
    setSelectedCategory(id);
    setPage(0);
  }, []);

  const handleTypeSelect = useCallback((type: string | undefined) => {
    setSelectedType(type);
    setPage(0);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground">HTM MARKETPLACE</h1>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">Trade future professional time commitments</p>
          </div>
          {isSignedIn && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreateRfpOpen(true)}
                className="font-mono text-xs gap-1.5"
                data-testid="btn-create-rfp"
              >
                <Users className="h-3.5 w-3.5" />
                POST RFP
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateListingOpen(true)}
                className="font-mono text-xs gap-1.5"
                data-testid="btn-create-listing"
              >
                <Plus className="h-3.5 w-3.5" />
                LIST TIME
              </Button>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <div className="flex items-center gap-4 mb-4">
            <TabsList className="font-mono text-xs h-8">
              <TabsTrigger value="listings" className="text-xs gap-1.5 px-3" data-testid="tab-listings">
                <TrendingUp className="h-3.5 w-3.5" />
                LISTINGS
              </TabsTrigger>
              <TabsTrigger value="rfps" className="text-xs gap-1.5 px-3" data-testid="tab-rfps">
                <FileSearch className="h-3.5 w-3.5" />
                RFP BOARD
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="listings" className="mt-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search listings..."
                  className="pl-9 font-mono text-xs bg-card h-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-search-marketplace"
                />
              </div>

              <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setPage(0); }}>
                <SelectTrigger className="w-28 h-8 font-mono text-xs bg-card" data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-mono text-xs">
                  <SelectItem value="open">OPEN</SelectItem>
                  <SelectItem value="in_bidding">BIDDING</SelectItem>
                  <SelectItem value="committed">COMMITTED</SelectItem>
                  <SelectItem value="completed">COMPLETED</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                className="h-8 gap-1.5 font-mono text-xs"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="btn-filter"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                FILTER
              </Button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-card border border-border rounded-sm">
                <Select
                  value={selectedType ?? "all"}
                  onValueChange={(v) => handleTypeSelect(v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="w-36 h-7 font-mono text-xs bg-background" data-testid="select-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent className="font-mono text-xs">
                    <SelectItem value="all">ALL TYPES</SelectItem>
                    <SelectItem value="fixed_rate">FIXED RATE</SelectItem>
                    <SelectItem value="auction">AUCTION</SelectItem>
                    <SelectItem value="emergency">EMERGENCY</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => handleCategorySelect(undefined)}
                    className={`font-mono text-[10px] px-2 py-1 rounded-sm border transition-colors ${
                      !selectedCategory
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    ALL
                  </button>
                  {categories?.filter(c => !c.parentId).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(selectedCategory === cat.id ? undefined : cat.id)}
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
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-64 border border-dashed border-border rounded-sm bg-card/50">
                <div className="text-center">
                  <div className="inline-flex p-3 rounded-full bg-muted mb-4">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h2 className="text-base font-mono font-semibold text-foreground">No listings found</h2>
                  <p className="text-xs text-muted-foreground mt-2 font-mono max-w-xs mx-auto">
                    {isSignedIn ? "Be the first to list your time in this market." : "Check back soon or sign in to list your time."}
                  </p>
                  {isSignedIn && (
                    <Button
                      size="sm"
                      className="mt-4 font-mono text-xs gap-1.5"
                      onClick={() => setCreateListingOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      LIST YOUR TIME
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>

                {total > PAGE_SIZE && (
                  <div className="flex items-center justify-between mt-6 font-mono text-xs text-muted-foreground">
                    <span>{total} listing{total !== 1 ? "s" : ""} total</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page === 0}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span>{page + 1} / {totalPages}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage(p => p + 1)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="rfps" className="mt-0">
            <RfpBoard onCreateRfp={() => setCreateRfpOpen(true)} />
          </TabsContent>
        </Tabs>
      </main>

      <CreateListingSheet
        open={createListingOpen}
        onOpenChange={setCreateListingOpen}
      />
      <CreateRfpSheet
        open={createRfpOpen}
        onOpenChange={setCreateRfpOpen}
      />
    </div>
  );
}
