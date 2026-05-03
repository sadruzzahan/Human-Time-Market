import { useState } from "react";
import { useCreateListing, useListSkillCategories, getListListingsQueryKey, getGetMyListingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Clock, Gavel, Zap } from "lucide-react";
import { useLocation } from "wouter";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const LISTING_TYPES = [
  {
    value: "fixed_rate",
    label: "Fixed Rate",
    desc: "Set a firm hourly rate. Buyers book directly at your price.",
    icon: <Clock className="h-4 w-4 text-primary" />,
  },
  {
    value: "auction",
    label: "Auction",
    desc: "Let the market determine your rate. Buyers bid competitively.",
    icon: <Gavel className="h-4 w-4 text-yellow-400" />,
  },
  {
    value: "emergency",
    label: "Emergency",
    desc: "Available immediately for urgent engagements. Premium rates apply.",
    icon: <Zap className="h-4 w-4 text-red-400" />,
  },
] as const;

type Step = "type" | "details" | "pricing" | "confirm";

function stepLabel(s: Step): string {
  const map: Record<Step, string> = {
    type: "Select Type",
    details: "Details",
    pricing: "Pricing & Schedule",
    confirm: "Review",
  };
  return map[s];
}

const STEPS: Step[] = ["type", "details", "pricing", "confirm"];

export default function CreateListingSheet({ open, onOpenChange }: Props) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const { data: categories } = useListSkillCategories();
  const parentCategories = categories ?? [];

  const [step, setStep] = useState<Step>("type");
  const [listingType, setListingType] = useState<"fixed_rate" | "auction" | "emergency">("fixed_rate");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillCategoryId, setSkillCategoryId] = useState<number | "">("");
  const [hoursPerWeek, setHoursPerWeek] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rateDollars, setRateDollars] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);

  const createListing = useCreateListing({
    mutation: {
      onSuccess: (data) => {
        setCreatedId(data.id);
        qc.invalidateQueries({ queryKey: getListListingsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetMyListingsQueryKey() });
        setStep("confirm");
      },
    },
  });

  function reset() {
    setStep("type");
    setListingType("fixed_rate");
    setTitle("");
    setDescription("");
    setSkillCategoryId("");
    setHoursPerWeek("");
    setStartDate("");
    setEndDate("");
    setRateDollars("");
    setCreatedId(null);
    createListing.reset();
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function handleSubmit() {
    if (!skillCategoryId || !title || !hoursPerWeek || !startDate || !endDate || !rateDollars) return;
    createListing.mutate({
      data: {
        title,
        description: description || undefined,
        skillCategoryId: Number(skillCategoryId),
        hoursPerWeek: Number(hoursPerWeek),
        startDate,
        endDate,
        listingType,
        rateCents: Math.round(parseFloat(rateDollars) * 100),
      },
    });
  }

  const stepIdx = STEPS.indexOf(step);
  const canNextDetails = title.trim().length >= 3 && !!skillCategoryId;
  const canNextPricing = !!hoursPerWeek && !!startDate && !!endDate && !!rateDollars;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-mono text-sm font-semibold">LIST YOUR TIME</SheetTitle>
          <div className="flex items-center gap-1 mt-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i < stepIdx ? "bg-primary" : i === stepIdx ? "bg-primary/60" : "bg-muted"
                  }`}
                />
              </div>
            ))}
            <span className="text-[10px] font-mono text-muted-foreground ml-2">{stepLabel(step)}</span>
          </div>
        </SheetHeader>

        {step === "type" && (
          <div className="space-y-3">
            <p className="text-xs font-mono text-muted-foreground mb-4">Choose how you want to sell your time</p>
            {LISTING_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setListingType(t.value)}
                className={`w-full text-left p-4 rounded-sm border transition-all ${
                  listingType === t.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
                data-testid={`listing-type-${t.value}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {t.icon}
                  <span className="font-mono font-semibold text-sm text-foreground">{t.label}</span>
                  {listingType === t.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                </div>
                <p className="text-xs font-mono text-muted-foreground">{t.desc}</p>
              </button>
            ))}
            <Button
              className="w-full font-mono text-xs mt-4 gap-1.5"
              onClick={() => setStep("details")}
              data-testid="btn-next-step"
            >
              NEXT
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Listing Title *</Label>
              <Input
                placeholder="e.g. Senior React Developer – 20h/wk, Q3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-listing-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Skill Category *</Label>
              <Select
                value={skillCategoryId !== "" ? String(skillCategoryId) : undefined}
                onValueChange={(v) => setSkillCategoryId(Number(v))}
              >
                <SelectTrigger className="font-mono text-xs" data-testid="select-skill-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="font-mono text-xs max-h-60">
                  {parentCategories.map((parent) => (
                    <SelectGroup key={parent.id}>
                      <SelectLabel className="text-[10px] text-muted-foreground font-semibold uppercase px-2 py-1.5">
                        {parent.name}
                      </SelectLabel>
                      {parent.children.map((child) => (
                        <SelectItem key={child.id} value={String(child.id)}>
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Description</Label>
              <Textarea
                placeholder="Describe your experience, availability, and what you're looking for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="font-mono text-sm resize-none"
                rows={4}
                data-testid="input-listing-description"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 font-mono text-xs gap-1.5" onClick={() => setStep("type")}>
                <ChevronLeft className="h-3.5 w-3.5" />
                BACK
              </Button>
              <Button
                className="flex-1 font-mono text-xs gap-1.5"
                disabled={!canNextDetails}
                onClick={() => setStep("pricing")}
                data-testid="btn-next-step"
              >
                NEXT
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {step === "pricing" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">End Date *</Label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Hours Per Week *</Label>
              <Input
                type="number"
                min="1"
                max="80"
                placeholder="e.g. 20"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-hours-per-week"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">
                {listingType === "auction" ? "Reserve Rate ($/hr) *" : "Hourly Rate ($/hr) *"}
              </Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 200"
                value={rateDollars}
                onChange={(e) => setRateDollars(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-rate"
              />
              {listingType === "auction" && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  This is the minimum rate you'll accept. Bids may go higher.
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 font-mono text-xs gap-1.5" onClick={() => setStep("details")}>
                <ChevronLeft className="h-3.5 w-3.5" />
                BACK
              </Button>
              <Button
                className="flex-1 font-mono text-xs gap-1.5"
                disabled={!canNextPricing}
                onClick={handleSubmit}
                data-testid="btn-submit-listing"
              >
                {createListing.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                PUBLISH LISTING
              </Button>
            </div>
            {createListing.error && (
              <p className="text-xs text-destructive font-mono">Failed to create listing. Please try again.</p>
            )}
          </div>
        )}

        {step === "confirm" && createdId && (
          <div className="text-center py-6 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-full bg-primary/20 items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-foreground text-base">Listing Published</h3>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Your time is now live on the marketplace.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-6">
              <Button
                className="w-full font-mono text-xs"
                onClick={() => {
                  handleClose(false);
                  setLocation(`/listings/${createdId}`);
                }}
                data-testid="btn-view-listing"
              >
                VIEW YOUR LISTING
              </Button>
              <Button
                variant="outline"
                className="w-full font-mono text-xs"
                onClick={() => handleClose(false)}
              >
                BACK TO MARKETPLACE
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
