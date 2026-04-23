import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Attendance from "@/pages/attendance";
import Schedule from "@/pages/schedule";
import Settings from "@/pages/settings";
import { useEffect } from "react";

const queryClient = new QueryClient();

function PageTracker() {
  const [location] = useLocation();

  useEffect(() => {
    if (
      typeof window.gtag === "function" &&
      import.meta.env.VITE_GA_MEASUREMENT_ID
    ) {
      window.gtag("event", "page_view", {
        page_path: location,
      });
    }
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Attendance} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PageTracker />
          <Router />
        </WouterRouter>
        <Toaster position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
