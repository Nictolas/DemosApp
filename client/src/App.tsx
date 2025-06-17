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
import GestisciElezioni from "@/pages/GestisciElezioni";
import Opinioni from "@/pages/Opinioni";
import Rappresentanti from "@/pages/Rappresentanti";
import Elezioni from "@/pages/Elezioni";
import ScegliRappresentante from "@/pages/ScegliRappresentante";
import ScegliCandidato from "@/pages/ScegliCandidato";
import StatisticheUtenti from "@/pages/StatisticheUtenti";
import StatisticheOpinioni from "@/pages/StatisticheOpinioni";
import RegistrazioneCandidatura from "@/pages/RegistrazioneCandidatura";
import RegistrazioneElezione from "@/pages/RegistrazioneElezione";
import RegistrazioneElezioneCandidatura from "@/pages/RegistrazioneElezioneCandidatura";
import Comunica from "@/pages/Comunica";
import PodioTrasparenza from "@/pages/PodioTrasparenza";
import Notifiche from "@/pages/Notifiche";
import ModificaImmagine from "@/pages/ModificaImmagine";
import CapodiStato from "@/pages/CapodiStato";
import Governo from "@/pages/Governo";
import Grazia from "@/pages/Grazia";
import Amnistia from "@/pages/Amnistia";
import Vota from "@/pages/Vota";
import Comizi from "@/pages/Comizi";
import Proponi from "@/pages/Proponi";
import IniziativePopolare from "@/pages/IniziativePopolare";
import ReferendumAbrogativi from "@/pages/ReferendumAbrogativi";
import Sostenitori from "@/pages/Sostenitori";
import Statistiche from "@/pages/Statistiche";
import Gestisci from "@/pages/Gestisci";
import Impostazioni from "@/pages/Impostazioni";
import ReclamaProfilo from "@/pages/ReclamaProfilo";
import DettaglioOpinione from "@/pages/opinioni/DettaglioOpinione";
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
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/profilo" component={Profilo} />
          </PageTransition>
        )}
      </Route>
      <Route path="/modifica-immagine">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/modifica-immagine" component={ModificaImmagine} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-utenti">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-utenti" component={GestisciUtenti} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-elezioni">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-elezioni" component={GestisciElezioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/opinioni/:opinionField/:regionName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName" 
              component={() => <DettaglioOpinione opinionField={params.opinionField} regionName={params.regionName} />} 
            />
          </PageTransition>
        )}
      </Route>

      {/* 2. La rotta generica che avevi già (ora gestisce il caso senza regione) */}
      <Route path="/opinioni/:opinionField">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField" 
              component={() => <DettaglioOpinione opinionField={params.opinionField} />} 
            />
          </PageTransition>
        )}
      </Route>

      {/* 2. La rotta generica per la pagina principale delle opinioni va DOPO */}
      <Route path="/opinioni">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni" component={Opinioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/rappresentanti">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/rappresentanti" component={Rappresentanti} />
          </PageTransition>
        )}
      </Route>
      <Route path="/elezioni">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/elezioni" component={Elezioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/scegli-rappresentante/:categoria">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/scegli-rappresentante/:categoria" component={ScegliRappresentante} />
          </PageTransition>
        )}
      </Route>
      <Route path="/scegli-candidato/:categoria">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/scegli-candidato/:categoria" component={ScegliCandidato} />
          </PageTransition>
        )}
      </Route>
      <Route path="/statistiche-utenti">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/statistiche-utenti" component={StatisticheUtenti} />
          </PageTransition>
        )}
      </Route>
      <Route path="/statistiche-opinioni">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/statistiche-opinioni" component={StatisticheOpinioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/comunica">
        {(params) => (
          <PageTransition location={location} type="fade-side" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/comunica" component={Comunica} />
          </PageTransition>
        )}
      </Route>
      <Route path="/podio-trasparenza">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <PodioTrasparenza />
          </PageTransition>
        )}
      </Route>
      <Route path="/notifiche">
        {(params) => (
          <PageTransition location={location} type="fade-side" showLoader={true} loaderDuration={350}>
            <ProtectedRoute path="/notifiche" component={Notifiche} />
          </PageTransition>
        )}
      </Route>
      <Route path="/capo-di-stato">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/capo-di-stato" component={CapodiStato} />
          </PageTransition>
        )}
      </Route>
      <Route path="/governo">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/governo" component={Governo} />
          </PageTransition>
        )}
      </Route>
      <Route path="/grazia">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/grazia" component={Grazia} />
          </PageTransition>
        )}
      </Route>
      <Route path="/amnistia">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/amnistia" component={Amnistia} />
          </PageTransition>
        )}
      </Route>
      <Route path="/vota">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/vota" component={Vota} />
          </PageTransition>
        )}
      </Route>
      <Route path="/comizi">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/comizi" component={Comizi} />
          </PageTransition>
        )}
      </Route>
      <Route path="/proponi">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/proponi" component={Proponi} />
          </PageTransition>
        )}
      </Route>
      <Route path="/iniziative-popolari">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/iniziative-popolari" component={IniziativePopolare} />
          </PageTransition>
        )}
      </Route>
      <Route path="/referendum-abrogativi">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/referendum-abrogativi" component={ReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>
      <Route path="/sostenitori">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/sostenitori" component={Sostenitori} />
          </PageTransition>
        )}
      </Route>
      <Route path="/statistiche">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/statistiche" component={Statistiche} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/gestisci" component={Gestisci} />
          </PageTransition>
        )}
      </Route>
      <Route path="/impostazioni">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/impostazioni" component={Impostazioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/reclama-profilo">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/reclama-profilo" component={ReclamaProfilo} />
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
