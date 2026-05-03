import { useState } from "react";
import { useCreateRfp, useListSkillCategories, getListRfpsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function CreateRfpSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: categories } = useListSkillCategories();
  const parentCategories = categories ?? [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillCategoryId, setSkillCategoryId] = useState<number | "">("");
  const [budgetMinDollars, setBudgetMinDollars] = useState("");
  const [budgetMaxDollars, setBudgetMaxDollars] = useState("");
  const [hoursNeeded, setHoursNeeded] = useState("");
  const [deadline, setDeadline] = useState("");
  const [done, setDone] = useState(false);

  const createRfp = useCreateRfp({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListRfpsQueryKey() });
        setDone(true);
      },
    },
  });

  function reset() {
    setTitle("");
    setDescription("");
    setSkillCategoryId("");
    setBudgetMinDollars("");
    setBudgetMaxDollars("");
    setHoursNeeded("");
    setDeadline("");
    setDone(false);
    createRfp.reset();
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function handleSubmit() {
    if (!title || !description || !skillCategoryId || !budgetMinDollars || !budgetMaxDollars || !hoursNeeded || !deadline) return;
    createRfp.mutate({
      data: {
        title,
        description,
        skillCategoryId: Number(skillCategoryId),
        budgetMinCents: Math.round(parseFloat(budgetMinDollars) * 100),
        budgetMaxCents: Math.round(parseFloat(budgetMaxDollars) * 100),
        hoursNeeded: Number(hoursNeeded),
        deadline,
      },
    });
  }

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 10 && !!skillCategoryId && !!budgetMinDollars && !!budgetMaxDollars && !!hoursNeeded && !!deadline;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-mono text-sm font-semibold">POST REQUEST FOR PROFESSIONALS</SheetTitle>
          <p className="text-xs font-mono text-muted-foreground">Describe what you need and let professionals come to you</p>
        </SheetHeader>

        {done ? (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex h-16 w-16 rounded-full bg-primary/20 items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-foreground text-base">RFP Posted</h3>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Professionals can now respond to your request.
              </p>
            </div>
            <Button className="w-full font-mono text-xs mt-4" onClick={() => handleClose(false)}>
              BACK TO MARKETPLACE
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Title *</Label>
              <Input
                placeholder="e.g. Need React developer for Q3 product launch"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-rfp-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Skill Category *</Label>
              <Select value={skillCategoryId !== "" ? String(skillCategoryId) : undefined} onValueChange={(v) => setSkillCategoryId(Number(v))}>
                <SelectTrigger className="font-mono text-xs" data-testid="select-rfp-category">
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
              <Label className="font-mono text-xs">Description *</Label>
              <Textarea
                placeholder="Describe the project, required skills, and expectations..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="font-mono text-sm resize-none"
                rows={4}
                data-testid="input-rfp-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Budget Min ($/hr) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 100"
                  value={budgetMinDollars}
                  onChange={(e) => setBudgetMinDollars(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-rfp-budget-min"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Budget Max ($/hr) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 250"
                  value={budgetMaxDollars}
                  onChange={(e) => setBudgetMaxDollars(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-rfp-budget-max"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Total Hours Needed *</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 80"
                  value={hoursNeeded}
                  onChange={(e) => setHoursNeeded(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-rfp-hours"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs">Response Deadline *</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="font-mono text-xs"
                  data-testid="input-rfp-deadline"
                />
              </div>
            </div>

            {createRfp.error && (
              <p className="text-xs text-destructive font-mono">Failed to post RFP. Please try again.</p>
            )}

            <Button
              className="w-full font-mono text-xs gap-1.5 mt-2"
              disabled={!canSubmit || createRfp.isPending}
              onClick={handleSubmit}
              data-testid="btn-submit-rfp"
            >
              {createRfp.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              POST RFP
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
