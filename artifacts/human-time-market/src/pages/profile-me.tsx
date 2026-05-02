import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetMyProfile, 
  useUpsertMyProfile, 
  useGetMySkills,
  useUpdateMySkills,
  useListSkillCategories,
  getGetMyProfileQueryKey,
  getGetMySkillsQueryKey,
  type UserProfile,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const profileSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  bio: z.string().optional(),
  timezone: z.string().min(1, { message: "Timezone is required." }),
  experienceLevel: z.enum(["junior", "mid", "senior", "principal", "expert"]),
  hourlyRateBaselineCents: z.coerce.number().min(1000, { message: "Minimum rate is $10/hr." }),
});

export default function ProfileMe() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);

  const { data: profile, isLoading: isProfileLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() }
  });
  
  const { data: mySkills, isLoading: isSkillsLoading } = useGetMySkills({
    query: { queryKey: getGetMySkillsQueryKey() }
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
      hourlyRateBaselineCents: 5000,
    },
  });

  // Populate form and skills when data loads
  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName,
        bio: profile.bio || "",
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        experienceLevel: profile.experienceLevel,
        hourlyRateBaselineCents: profile.hourlyRateBaselineCents || 5000,
      });
    }
  }, [profile, form]);

  useEffect(() => {
    if (mySkills) {
      setSelectedSkills(mySkills.map(s => s.skillCategoryId));
    }
  }, [mySkills]);

  if (isProfileLoading || isCategoriesLoading || isSkillsLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmitProfile(values: z.infer<typeof profileSchema>) {
    try {
      await upsertProfile.mutateAsync({
        data: values
      });
      queryClient.setQueryData<UserProfile | undefined>(
        getGetMyProfileQueryKey(),
        (old) => (old ? { ...old, ...values } : old),
      );
      toast({
        title: "Profile updated",
        description: "Your terminal profile has been updated.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "There was an error saving your profile.",
        variant: "destructive",
      });
    }
  }

  async function onSubmitSkills() {
    if (selectedSkills.length === 0) {
      toast({
        title: "Selection required",
        description: "Please select at least one skill category.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateSkills.mutateAsync({
        data: { skillCategoryIds: selectedSkills }
      });
      await queryClient.invalidateQueries({ queryKey: getGetMySkillsQueryKey() });
      toast({
        title: "Skills updated",
        description: "Your market positioning has been updated.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "There was an error saving your skills.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold tracking-tight">Terminal Profile</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Manage your market identity and capabilities</p>
        </div>

        <Tabs defaultValue="identity" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8 bg-card border border-border">
            <TabsTrigger value="identity" className="font-mono text-xs">Identity</TabsTrigger>
            <TabsTrigger value="positioning" className="font-mono text-xs">Market Positioning</TabsTrigger>
          </TabsList>
          
          <TabsContent value="identity">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono">Identity Configuration</CardTitle>
                <CardDescription className="font-mono text-xs">Update your public profile details.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-xs text-muted-foreground">DISPLAY NAME</FormLabel>
                            <FormControl>
                              <Input {...field} className="font-mono bg-input" data-testid="input-display-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="hourlyRateBaselineCents"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-mono text-xs text-muted-foreground">BASELINE RATE (CENTS)</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground font-mono">$</span>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                  className="pl-7 font-mono bg-input" 
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
                    </div>

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs text-muted-foreground">BIO</FormLabel>
                          <FormControl>
                            <Textarea 
                              className="resize-none font-mono bg-input h-24" 
                              {...field} 
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
                            <FormLabel className="font-mono text-xs text-muted-foreground">TIMEZONE</FormLabel>
                            <FormControl>
                              <Input {...field} className="font-mono bg-input" />
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
                            <FormLabel className="font-mono text-xs text-muted-foreground">EXPERIENCE</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="font-mono bg-input">
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

                    <div className="flex justify-end">
                      <Button type="submit" disabled={upsertProfile.isPending} className="font-mono" data-testid="btn-save-profile">
                        {upsertProfile.isPending ? "SAVING..." : "SAVE CONFIGURATION"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positioning">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-mono">Market Skills</CardTitle>
                <CardDescription className="font-mono text-xs">Define the markets where you sell your time (max 5).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/30 p-4 border border-border rounded-md">
                  <p className="text-xs font-mono text-muted-foreground mb-3 flex justify-between">
                    <span>ACTIVE MARKETS</span>
                    <span>{selectedSkills.length} / 5</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills.length === 0 ? (
                      <span className="text-xs text-muted-foreground font-mono">None selected</span>
                    ) : (
                      selectedSkills.map(id => {
                        const category = categories?.find(c => c.id === id) || 
                                         categories?.flatMap(c => c.children).find(c => c.id === id);
                        return (
                          <span key={id} className="bg-primary/10 text-primary border border-primary/20 px-2 py-1 text-xs font-mono rounded">
                            {category?.name || `ID: ${id}`}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {categories?.map((category) => (
                    <div key={category.id} className="space-y-3">
                      <h3 className="font-mono font-medium text-xs text-muted-foreground border-b border-border pb-1">
                        {category.name.toUpperCase()}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {category.children.map((child) => {
                          const isSelected = selectedSkills.includes(child.id);
                          const isDisabled = !isSelected && selectedSkills.length >= 5;
                          
                          return (
                            <div key={child.id} className="flex items-start space-x-2">
                              <Checkbox 
                                id={`edit-skill-${child.id}`}
                                checked={isSelected}
                                disabled={isDisabled}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedSkills([...selectedSkills, child.id]);
                                  } else {
                                    setSelectedSkills(selectedSkills.filter(id => id !== child.id));
                                  }
                                }}
                              />
                              <label 
                                htmlFor={`edit-skill-${child.id}`}
                                className={`text-xs font-mono leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${isSelected ? 'text-primary font-medium' : 'text-foreground'}`}
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

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button 
                    onClick={onSubmitSkills} 
                    disabled={updateSkills.isPending || selectedSkills.length === 0} 
                    className="font-mono"
                    data-testid="btn-save-skills"
                  >
                    {updateSkills.isPending ? "SAVING..." : "UPDATE POSITIONING"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
