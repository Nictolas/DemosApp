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
import RegistrazioneCandidatura from "@/pages/RegistrazioneCandidatura";
import RegistrazioneElezione from "@/pages/RegistrazioneElezione";
import RegistrazioneElezioneCandidatura from "@/pages/RegistrazioneElezioneCandidatura";
import { AuthProvider } from "@/hooks/use-auth";
import { RegistrationProvider } from "@/hooks/use-registration";
import { ProtectedRoute } from "@/lib/protected-route";
import { PageTransition } from "@/components/PageTransition";

function Router() {
  const [location] = useLocation();
  
  return (
    <Switch>
      <Route path="/">
        {() => (
          <PageTransition location={location} type="fade-up" delay={100}>
            <LandingPage />
          </PageTransition>
        )}
      </Route>
      <Route path="/auth">
        {() => (
          <PageTransition location={location} type="fade-up">
            <AuthPage />
          </PageTransition>
        )}
      </Route>
      <Route path="/registrazione">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/registrazione" component={Home} />
          </PageTransition>
        )}
      </Route>
      <Route path="/registrazione-candidatura">
        {() => (
          <PageTransition location={location} type="fade-up">
            <RegistrazioneCandidatura />
          </PageTransition>
        )}
      </Route>
      <Route path="/registrazione-elezione">
        {() => (
          <PageTransition location={location} type="fade-up">
            <RegistrazioneElezione />
          </PageTransition>
        )}
      </Route>
      <Route path="/registrazione-elezione-candidatura">
        {() => (
          <PageTransition location={location} type="fade-up">
            <RegistrazioneElezioneCandidatura />
          </PageTransition>
        )}
      </Route>
      <Route path="/menu">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/menu" component={Menu} />
          </PageTransition>
        )}
      </Route>
      <Route path="/profilo">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/profilo" component={Profilo} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-utenti">
        {(params) => (
          <PageTransition location={location}>
            <ProtectedRoute path="/gestisci-utenti" component={GestisciUtenti} />
          </PageTransition>
        )}
      </Route>
      <Route path="/opinioni">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/opinioni" component={Opinioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/:rest*">
        {() => (
          <PageTransition location={location} type="fade-up">
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
        <RegistrationProvider>
          <Router />
          <Toaster />
        </RegistrationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
