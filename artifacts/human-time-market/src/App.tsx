import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Navbar from "@/components/navbar";
import Home from "@/pages/home";
import Marketplace from "@/pages/marketplace";
import PriceIndex from "@/pages/price-index";
import Dashboard from "@/pages/dashboard";
import Onboarding from "@/pages/onboarding";
import ProfileMe from "@/pages/profile-me";
import ProfileUser from "@/pages/profile-user";
import ListingDetail from "@/pages/listing-detail";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(191 100% 50%)",
    colorForeground: "hsl(0 0% 98%)",
    colorMutedForeground: "hsl(240 5% 65%)",
    colorDanger: "hsl(0 62.8% 30.6%)",
    colorBackground: "hsl(240 10% 6%)",
    colorInput: "hsl(240 5% 15%)",
    colorInputForeground: "hsl(0 0% 98%)",
    colorNeutral: "hsl(240 5% 15%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.25rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-card rounded-md w-[440px] max-w-full overflow-hidden border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-500",
    alertText: "text-destructive-foreground",
    logoBox: "flex justify-center",
    logoImage: "h-8 object-contain",
    socialButtonsBlockButton: "border-border hover:bg-muted",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
    formFieldInput: "bg-input border-border text-foreground focus:ring-ring",
    footerAction: "bg-transparent",
    dividerLine: "bg-border",
    alert: "bg-destructive border-destructive text-destructive-foreground",
    otpCodeFieldInput: "bg-input border-border text-foreground focus:ring-ring",
    formFieldRow: "mb-4",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      const prevId = prevUserIdRef.current;
      if (prevId !== undefined && prevId !== userId) {
        // Clear cache only on sign-out or user-switch — not on initial sign-in
        // (null → userId). Clearing on sign-in causes a render loop because
        // Clerk fires multiple rapid events during programmatic auth.
        if (userId === null || (prevId !== null && prevId !== userId)) {
          qc.clear();
        }
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function useOnboardingStatus() {
  const { isSignedIn, isLoaded } = useAuth();
  const query = useGetMyProfile({
    query: {
      enabled: isLoaded && !!isSignedIn,
      queryKey: getGetMyProfileQueryKey(),
      retry: false,
    },
  });
  return {
    isSignedIn: !!isSignedIn,
    isAuthLoaded: isLoaded,
    isProfileLoaded: !query.isLoading,
    isOnboarded: query.data?.isOnboarded === true,
    profileMissing:
      !query.isLoading &&
      !query.data &&
      !!query.error,
  };
}

function HomeRedirect() {
  const { isSignedIn, isAuthLoaded, isProfileLoaded, isOnboarded } = useOnboardingStatus();
  if (!isAuthLoaded) return null;
  if (!isSignedIn) return <Home />;
  if (!isProfileLoaded) return null;
  return <Redirect to={isOnboarded ? "/marketplace" : "/onboarding"} />;
}

function SignedInGate({ component: Component, allowUnonboarded = false }: { component: React.ComponentType; allowUnonboarded?: boolean }) {
  const { isSignedIn, isAuthLoaded, isProfileLoaded, isOnboarded } = useOnboardingStatus();
  if (!isAuthLoaded) return null;
  if (!isSignedIn) return <Redirect to="/" />;
  if (!isProfileLoaded) return null;
  if (!allowUnonboarded && !isOnboarded) return <Redirect to="/onboarding" />;
  if (allowUnonboarded && isOnboarded) return <Redirect to="/marketplace" />;
  return <Component />;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <SignedInGate component={Component} />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function OnboardingRoute() {
  return (
    <>
      <Show when="signed-in">
        <SignedInGate component={Onboarding} allowUnonboarded />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// Marketplace is publicly browsable but if the user is signed in and hasn't
// completed onboarding yet, redirect them there so a user row is created and
// their profile is configured before they try to transact.
function MarketplaceRoute() {
  const { isSignedIn, isAuthLoaded, isProfileLoaded, isOnboarded } = useOnboardingStatus();
  // While Clerk is initialising, don't block the page from rendering
  if (!isAuthLoaded || !isSignedIn) return <Marketplace />;
  // Profile loading: still show the page (it'll show a loading skeleton)
  if (!isProfileLoaded) return <Marketplace />;
  // Signed in but never completed onboarding
  if (!isOnboarded) return <Redirect to="/onboarding" />;
  return <Marketplace />;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Access Terminal",
            subtitle: "Authenticate to enter the Human Time Market",
          },
        },
        signUp: {
          start: {
            title: "Register",
            subtitle: "Create your market participant profile",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/marketplace" component={MarketplaceRoute} />
          <Route path="/listings/:listingId" component={ListingDetail} />
          <Route path="/price-index" component={PriceIndex} />
          <Route path="/profile/:userId" component={ProfileUser} />
          
          <Route path="/onboarding" component={OnboardingRoute} />
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} />
          </Route>
          <Route path="/profile/me">
            <ProtectedRoute component={ProfileMe} />
          </Route>
          
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <TooltipProvider>
        <ClerkProviderWithRoutes />
        <Toaster />
      </TooltipProvider>
    </WouterRouter>
  );
}

export default App;
