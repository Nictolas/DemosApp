import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/auth-page";
import Menu from "@/pages/Menu";
import Profilo from "@/pages/Profilo";
import GestisciUtenti from "@/pages/GestisciUtenti";
import Opinioni from "@/pages/Opinioni";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { PageTransition } from "@/components/PageTransition";

function Router() {
  const [location] = useLocation();
  
  return (
    <Switch>
      <Route path="/">
        {() => (
          <PageTransition location={location}>
            <LandingPage />
          </PageTransition>
        )}
      </Route>
      <Route path="/auth">
        {() => (
          <PageTransition location={location}>
            <AuthPage />
          </PageTransition>
        )}
      </Route>
      <ProtectedRoute path="/registrazione" component={Home} />
      <ProtectedRoute path="/menu" component={Menu} />
      <ProtectedRoute path="/profilo" component={Profilo} />
      <ProtectedRoute path="/gestisci-utenti" component={GestisciUtenti} />
      <ProtectedRoute path="/opinioni" component={Opinioni} />
      <Route path="/:rest*">
        {() => (
          <PageTransition location={location}>
            <NotFound />
          </PageTransition>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
