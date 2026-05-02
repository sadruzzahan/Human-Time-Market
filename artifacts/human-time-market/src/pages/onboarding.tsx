import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetMyProfile, 
  useUpsertMyProfile, 
  useListSkillCategories, 
  useUpdateMySkills,
  getGetMyProfileQueryKey,
  getGetMySkillsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";

const profileSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  bio: z.string().optional(),
  timezone: z.string().min(1, { message: "Timezone is required." }),
  experienceLevel: z.enum(["junior", "mid", "senior", "principal", "expert"]),
  hourlyRateBaselineCents: z.coerce.number().min(1000, { message: "Minimum rate is $10/hr." }),
});

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);

  const { data: profile, isLoading: isProfileLoading } = useGetMyProfile({
    query: {
      retry: false,
      queryKey: getGetMyProfileQueryKey()
    }
  });

  const { data: categories, isLoading: isCategoriesLoading } = useListSkillCategories();
  
  const upsertProfile = useUpsertMyProfile();
  const updateSkills = useUpdateMySkills();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      experienceLevel: "mid",
      hourlyRateBaselineCents: 5000, // $50.00
    },
  });

  useEffect(() => {
    if (profile?.isOnboarded) {
      setLocation("/marketplace");
    }
  }, [profile, setLocation]);

  if (isProfileLoading || isCategoriesLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
            <p className="text-muted-foreground font-mono">Loading terminal interface...</p>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmitProfile(values: z.infer<typeof profileSchema>) {
    setStep(2);
  }

  async function onComplete() {
    if (selectedSkills.length === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one skill category.",
        variant: "destructive",
      });
      return;
    }

    try {
      const formValues = form.getValues();
      await upsertProfile.mutateAsync({
        data: {
          displayName: formValues.displayName,
          bio: formValues.bio,
          timezone: formValues.timezone,
          experienceLevel: formValues.experienceLevel,
          hourlyRateBaselineCents: formValues.hourlyRateBaselineCents,
        }
      });

      await updateSkills.mutateAsync({
        data: {
          skillCategoryIds: selectedSkills
        }
      });

      await queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetMySkillsQueryKey() });

      toast({
        title: "Profile configured",
        description: "Welcome to the Human Time Market.",
      });
      
      setLocation("/marketplace");
    } catch (error) {
      toast({
        title: "Configuration failed",
        description: "There was an error saving your profile. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-sm text-primary">STEP 0{step}/02</span>
            <div className="h-1 w-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500" 
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">
            {step === 1 ? "Terminal Configuration" : "Market Positioning"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {step === 1 
              ? "Set up your market identity and baseline rate." 
              : "Select up to 5 skill categories for your public listing."}
          </p>
        </div>

        <div className="bg-card border border-border p-6 md:p-8 rounded-lg">
          {step === 1 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" {...field} className="font-mono bg-input" data-testid="input-display-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Professional Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief overview of your expertise and background..." 
                          className="resize-none font-mono bg-input h-24" 
                          {...field} 
                          data-testid="input-bio"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Timezone</FormLabel>
                        <FormControl>
                          <Input {...field} className="font-mono bg-input" data-testid="input-timezone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experienceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Experience Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="font-mono bg-input" data-testid="select-experience">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="junior">Junior (1-3 yrs)</SelectItem>
                            <SelectItem value="mid">Mid-Level (3-5 yrs)</SelectItem>
                            <SelectItem value="senior">Senior (5-8 yrs)</SelectItem>
                            <SelectItem value="principal">Principal (8-12 yrs)</SelectItem>
                            <SelectItem value="expert">Expert (12+ yrs)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="hourlyRateBaselineCents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase text-muted-foreground">Baseline Hourly Rate (Cents)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground font-mono">$</span>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                            className="pl-7 font-mono bg-input" 
                            data-testid="input-rate" 
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="font-mono text-xs">
                        Displayed as ${(field.value / 100).toFixed(2)}/hr
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" className="font-mono" data-testid="btn-next-step">
                    Proceed to Positioning
                  </Button>
                </div>
              </form>
            </Form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-muted/50 p-4 border border-border rounded-md mb-6">
                <p className="text-sm font-mono text-muted-foreground mb-2">SELECTED SKILLS</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.length === 0 ? (
                    <span className="text-sm text-muted-foreground italic font-mono">None selected</span>
                  ) : (
                    selectedSkills.map(id => {
                      const category = categories?.find(c => c.id === id) || 
                                       categories?.flatMap(c => c.children).find(c => c.id === id);
                      return (
                        <span key={id} className="bg-primary/20 text-primary border border-primary/30 px-2 py-1 text-xs font-mono rounded">
                          {category?.name || `ID: ${id}`}
                        </span>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3 font-mono text-right">{selectedSkills.length} / 5 MAXIMUM</p>
              </div>

              <div className="space-y-6">
                {categories?.map((category) => (
                  <div key={category.id} className="space-y-3">
                    <h3 className="font-mono font-medium text-sm text-foreground border-b border-border pb-1">
                      {category.name.toUpperCase()}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {category.children.map((child) => {
                        const isSelected = selectedSkills.includes(child.id);
                        const isDisabled = !isSelected && selectedSkills.length >= 5;
                        
                        return (
                          <div key={child.id} className="flex items-start space-x-2">
                            <Checkbox 
                              id={`skill-${child.id}`}
                              checked={isSelected}
                              disabled={isDisabled}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedSkills([...selectedSkills, child.id]);
                                } else {
                                  setSelectedSkills(selectedSkills.filter(id => id !== child.id));
                                }
                              }}
                              data-testid={`checkbox-skill-${child.id}`}
                            />
                            <label 
                              htmlFor={`skill-${child.id}`}
                              className={`text-sm font-mono leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${isSelected ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                            >
                              {child.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-6 border-t border-border">
                <Button variant="outline" onClick={() => setStep(1)} className="font-mono" data-testid="btn-prev-step">
                  Back
                </Button>
                <Button 
                  onClick={onComplete} 
                  disabled={selectedSkills.length === 0 || upsertProfile.isPending || updateSkills.isPending}
                  className="font-mono"
                  data-testid="btn-complete-onboarding"
                >
                  {(upsertProfile.isPending || updateSkills.isPending) ? "Initializing..." : "Initialize Terminal"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
