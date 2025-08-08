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
import RegistrazioneCandidatura from "@/pages/RegistrazioneCandidatura";
import RegistrazioneElezione from "@/pages/RegistrazioneElezione";
import RegistrazioneElezioneCandidatura from "@/pages/RegistrazioneElezioneCandidatura";
import Strumenti from "@/pages/Comunica";
import PodioTrasparenza from "@/pages/PodioTrasparenza";
import Notifiche from "@/pages/Notifiche";
import ModificaImmagine from "@/pages/ModificaImmagine";
import CapodiStato from "@/pages/CapodiStato";
import Governo from "@/pages/Governo";
import Grazia from "@/pages/Grazia";
import Amnistia from "@/pages/Amnistia";
import Vota from "@/pages/Vota";
import Eventi from "@/pages/Eventi";
import Proponi from "@/pages/Proponi";
import IniziativePopolare from "@/pages/IniziativePopolare";
import ReferendumAbrogativi from "@/pages/ReferendumAbrogativi";
import Sostenitori from "@/pages/Sostenitori";
import Gestisci from "@/pages/Gestisci";
import Impostazioni from "@/pages/Impostazioni";
import ReclamaProfilo from "@/pages/ReclamaProfilo";
import DettaglioOpinione from "@/pages/opinioni/DettaglioOpinione";
import { AuthProvider } from "@/hooks/use-auth";
import { RegistrationProvider } from "@/hooks/use-registration";
import { ProtectedRoute } from "@/lib/protected-route";
import { PageTransition } from "@/components/PageTransition";
import GestisciGrazia from "./pages/GestisciGrazia";
import GestisciOpinioni from "./pages/GestisciOpinioni";
import Limiti from "@/pages/Limiti";
import GestisciIniziativePopolari from "@/pages/GestisciIniziativePopolari";
import GestisciReferendumAbrogativi from "@/pages/GestisciReferendumAbrogativi";
import GestisciGoverno from "@/pages/GestisciGoverno";
import VotaIniziativaPopolare from "@/pages/VotaIniziativaPopolare";
import VotaReferendumAbrogativo from "@/pages/VotaReferendumAbrogativo";
import Votazione from "@/pages/Votazione";
import Evento from "@/pages/Evento";
import Programma from "@/pages/Programma";
import Dona from "@/pages/Dona";
import ProponiOpinione from "@/pages/ProponiOpinione";
import ICE from "@/pages/ICE";
import GestisciICE from "@/pages/GestisciICE";
import VotaICE from "@/pages/VotaICE";
import RegistrazioneWizard from "@/pages/RegistrazioneWizard";
import DebugAuth from "@/pages/debug-auth";
import Riscontro from "@/pages/Riscontro";
import Scadenze from "@/pages/Scadenze";
import Sondaggi from "@/pages/Sondaggi";
import ResetPasswordPage from "@/pages/reset-password";
import Informazioni from "@/pages/Informazioni";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import { useSyncFcmToken } from "@/hooks/useSyncFcmToken";
import React, { useEffect } from "react";
import Navbar from "@/components/Navbar";

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
      <Route path="/debug-auth">
        {() => (
          <PageTransition location={location} type="fade-up">
            <DebugAuth />
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
      <Route path="/registrazione-wizard">
        {() => (
          <PageTransition location={location} type="fade-up">
            <RegistrazioneWizard />
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
      <Route path="/menu/profilo">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/menu/profilo" component={Profilo} />
          </PageTransition>
        )}
      </Route>
      <Route path="/menu/profilo/:userId">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/menu/profilo/:userId" component={Profilo} />
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
      <Route path="/opinioni/:opinionField/:regionName/:provinceName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName/:provinceName" 
              component={() => <DettaglioOpinione opinionField={params.opinionField} regionName={params.regionName} provinceName={params.provinceName} />} 
            />
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
      <Route path="/opinioni/:opinionField/:regionName/:provinceName/:comuneName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName/:provinceName/:comuneName" 
              component={() => <DettaglioOpinione opinionField={params.opinionField} regionName={params.regionName} provinceName={params.provinceName} comuneName={params.comuneName} />} 
            />
          </PageTransition>
        )}
      </Route>
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
      <Route path="/sondaggi">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/sondaggi" component={Sondaggi} />
          </PageTransition>
        )}
      </Route>
      <Route path="/strumenti">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/strumenti" component={Strumenti} />
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
      <Route path="/eventi">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/eventi" component={Eventi} />
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
      <Route path="/proponi-opinione">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/proponi-opinione" component={ProponiOpinione} />
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
      <Route path="/gestisci-grazia">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-grazia" component={GestisciGrazia} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-opinioni">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-opinioni" component={GestisciOpinioni} />
          </PageTransition>
        )}
      </Route>
      <Route path="/limiti">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/limiti" component={() => <Limiti />} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-iniziative-popolari">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-iniziative-popolari" component={GestisciIniziativePopolari} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-referendum-abrogativi">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-referendum-abrogativi" component={GestisciReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-governo">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-governo" component={GestisciGoverno} />
          </PageTransition>
        )}
      </Route>
      <Route path="/vota-iniziativa-popolare">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/vota-iniziativa-popolare" component={VotaIniziativaPopolare} />
          </PageTransition>
        )}
      </Route>
      <Route path="/vota-referendum-abrogativo">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/vota-referendum-abrogativo" component={VotaReferendumAbrogativo} />
          </PageTransition>
        )}
      </Route>
      <Route path="/votazione">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/votazione" component={Votazione} />
          </PageTransition>
        )}
      </Route>
      <Route path="/evento">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/evento" component={Evento} />
          </PageTransition>
        )}
      </Route>
      <Route path="/programma">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/programma" component={Programma} />
          </PageTransition>
        )}
      </Route>
      <Route path="/dona">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <Dona />
          </PageTransition>
        )}
      </Route>
      <Route path="/ice">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/ice" component={ICE} />
          </PageTransition>
        )}
      </Route>
      <Route path="/gestisci-ice">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-ice" component={GestisciICE} />
          </PageTransition>
        )}
      </Route>
      <Route path="/vota-ice">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/vota-ice" component={VotaICE} />
          </PageTransition>
        )}
      </Route>
      <Route path="/riscontro">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/riscontro" component={Riscontro} />
          </PageTransition>
        )}
      </Route>
      <Route path="/scadenze">
        {(params) => (
          <PageTransition location={location} type="fade-up">
            <ProtectedRoute path="/scadenze" component={Scadenze} />
          </PageTransition>
        )}
      </Route>
      <Route path="/reset-password">
        {() => (
          <PageTransition location={location} type="fade-up">
            <ResetPasswordPage />
          </PageTransition>
        )}
      </Route>
      <Route path="/informazioni">
        {() => (
          <PageTransition location={location} type="fade-up">
            <Informazioni />
          </PageTransition>
        )}
      </Route>
      <Route path="/privacy-policy">
        {() => (
          <PageTransition location={location} type="fade-up">
            <PrivacyPolicy />
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

function SyncFcmTokenWrapper() {
  useSyncFcmToken();
  return null;
}

function App() {
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.touches && e.touches.length === 1) {
        touchEndX = e.touches[0].clientX;
        touchEndY = e.touches[0].clientY;
      }
    }

    function handleTouchEnd() {
      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);
      // Swipe da sinistra verso destra, orizzontale, almeno 60px e non troppo inclinato
      if (deltaX > 60 && deltaY < 40) {
        window.history.back();
      }
    }

    // Solo su dispositivi touch
    if ('ontouchstart' in window) {
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    return () => {
      if ('ontouchstart' in window) {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, []);
  const [location] = useLocation();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RegistrationProvider>
          <SyncFcmTokenWrapper />
          <Router />
          {location !== '/' && <Navbar />}
          <Toaster />
        </RegistrationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
