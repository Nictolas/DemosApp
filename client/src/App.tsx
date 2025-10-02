import React, { useEffect } from "react";
import { Route, Switch, useLocation, Redirect, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { AuthProvider } from "@/hooks/use-auth-neon";
import { RegistrationProvider } from "@/hooks/use-registration";
import { queryClient } from "./lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";

// Import dei componenti principali
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/auth-page";
import ResetPasswordConfirmPage from "./pages/reset-password-confirm";
import ResetPasswordPage from "./pages/reset-password";

// Import delle pagine di registrazione separate
import RegistrazioneNome from "./pages/registrazione-nome";
import RegistrazioneGenere from "./pages/registrazione-genere";
import RegistrazioneCittadinanza from "./pages/registrazione-cittadinanza";
import RegistrazioneDataNascita from "./pages/registrazione-data-nascita";
import RegistrazioneResidenza from "./pages/registrazione-3-residenza";
import RegistrazioneRuolo from "./pages/registrazione-ruolo";
import VerificaEmailStandalone from "./pages/VerificaEmailStandalone";
import ConfermaEmail from "./pages/ConfermaEmail";
import Menu from "./pages/Menu";
import Profilo from "./pages/Profilo";
import Impostazioni from "./pages/Impostazioni";
import SegnalaProblema from "./pages/SegnalaProblema";
import ScaricaDati from "./pages/Impostazioni/ScaricaDati";
import CancellaAccount from "./pages/Impostazioni/CancellaAccount";
import GestionePrivacy from "./pages/Impostazioni/GestionePrivacy";
import LimitazioneTrattamento from "./pages/Impostazioni/LimitazioneTrattamento";
import OpposizioneTrattamento from "./pages/Impostazioni/OpposizioneTrattamento";
import Copyright from "./pages/Impostazioni/Copyright";
import GDPR from "./pages/GDPR";
import Opinioni from "./pages/Opinioni";
import OpinioniNazionali from "./pages/OpinioniNazionali";
import OpinioniRegionali from "./pages/OpinioniRegionali";
import OpinioniComunali from "./pages/OpinioniComunali";
import Rappresentanti from "./pages/Rappresentanti";
import ScegliRappresentante from "./pages/ScegliRappresentante";
import ScegliCandidato from "./pages/ScegliCandidato";
import Preferiti from "./pages/Preferiti";
import Candidati from "./pages/Candidati";
import Attivisti from "./pages/Attivisti";
import Organizzazioni from "./pages/Organizzazioni";
import Notifiche from "./pages/Notifiche";
import Vota from "./pages/Vota";
import Eventi from "./pages/Eventi";
import Gestisci from "./pages/Gestisci";
import Strumenti from "./pages/Strumenti";
import Sondaggi from "./pages/Sondaggi";
import Proponi from "./pages/Proponi";
import ProponiOpinione from "./pages/ProponiOpinione";
import CapodiStato from "./pages/CapodiStato";
import Amnistia from "./pages/Amnistia";
import Grazia from "./pages/Grazia";
import Governo from "./pages/Governo";
import MinisteroPage from "./pages/Governo/[slug]";
import ICE from "./pages/ICE";
import ReferendumAbrogativi from "./pages/ReferendumAbrogativi";
import IniziativePopolare from "./pages/IniziativePopolare";
import GestisciUtenti from "./pages/GestisciUtenti";
import GestisciElezioni from "./pages/GestisciElezioni";
import GestisciGrazia from "./pages/GestisciGrazia";
import GestisciOpinioni from "./pages/GestisciOpinioni";
import GestisciIniziativePopolari from "./pages/GestisciIniziativePopolari";
import GestisciReferendumAbrogativi from "./pages/GestisciReferendumAbrogativi";
import GestisciICE from "./pages/GestisciICE";
import GestisciGoverno from "./pages/GestisciGoverno";
import ModificaImmagine from "./pages/ModificaImmagine";
import StatisticheUtenti from "./pages/StatisticheUtenti";
import StatisticheOpinione from "./pages/StatisticheOpinione";
import SondaggiRegione from "./pages/SondaggiRegione";
import SondaggiProvincia from "./pages/SondaggiProvincia";
import SondaggiComune from "./pages/SondaggiComune";
import VotaIniziativaPopolare from "./pages/VotaIniziativaPopolare";
import VotaReferendumAbrogativo from "./pages/VotaReferendumAbrogativo";
import VotaICE from "./pages/VotaICE";
import Votazione from "./pages/Votazione";
import Sostenitori from "./pages/Sostenitori";
import Comunica from "./pages/Comunica";
import Evento from "./pages/Evento";
import Programma from "./pages/Programma";
import Riscontro from "./pages/Riscontro";
import OpinioniEuropee from "./pages/OpinioniEuropee";
import ProponiReferendumAbrogativi from "./pages/ProponiReferendumAbrogativi";
import ProponiIniziativaPopolare from "./pages/ProponiIniziativaPopolare";
import ProponiICE from "./pages/ProponiICE";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import SecurityMeasures from "./pages/SecurityMeasures";
import GDPRRights from "./pages/GDPRRights";
import DataRetention from "./pages/DataRetention";
import ViolationsDashboard from "./pages/ViolationsDashboard";
import SecurityDashboard from "./pages/SecurityDashboard";
import LegalDocuments from "./pages/LegalDocuments";
import BackupDashboard from "./pages/BackupDashboard";
import RateLimitingDashboard from "./pages/RateLimitingDashboard";
import ValidationDashboard from "./pages/ValidationDashboard";
import LoggingDashboard from "./pages/LoggingDashboard";
import MonitoringDashboard from "./pages/MonitoringDashboard";
import AuditDashboard from "./pages/AuditDashboard";
import AdminSecurityDashboard from "./pages/Admin/SecurityDashboard";
import GDPRLegalManagement from "./pages/Admin/GDPRLegalManagement";
import Approfondimento from "./pages/Approfondimento";
import Navbar from "./components/Navbar";
import { useBrowserNavigation } from "./hooks/useBrowserNavigation";
import { AppWrapper } from "./components/AppWrapper";

// Hook per la navigazione touch migliorato
function useTouchNavigation() {
  const [, setLocation] = useLocation();
  
  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isScrolling = false;
    let touchStartTime = 0;
    let isNavigating = false;

    const handleTouchStart = (e: TouchEvent) => {
      // Evita conflitti se già in navigazione
      if (isNavigating) return;
      
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isScrolling = false;
      touchStartTime = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY || isNavigating) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(startX - currentX);
      const diffY = Math.abs(startY - currentY);

      if (diffY > diffX) {
        isScrolling = true;
        return;
      }

      // Swipe più sensibile ma con controlli aggiuntivi
      if (diffX > 30 && !isScrolling) {
        const direction = startX > currentX ? 'right' : 'left';
        const touchDuration = Date.now() - touchStartTime;
        
        // Solo swipe veloci e da sinistra a destra
        if (direction === 'right' && touchDuration < 500) {
          // Preveni navigazione multipla
          if (isNavigating) return;
          isNavigating = true;
          
          // Naviga alla pagina precedente logica invece di usare history.back()
          const currentPath = window.location.pathname;
          const previousPath = getPreviousPath(currentPath);
          
          if (previousPath) {
            setLocation(previousPath);
          } else {
            // Fallback: vai al menu
            setLocation('/menu');
          }
          
          // Reset dopo un breve delay
          setTimeout(() => {
            isNavigating = false;
          }, 1000);
        }
      }
    };

    const handleTouchEnd = () => {
      // Reset dei valori
      startX = 0;
      startY = 0;
      isScrolling = false;
      touchStartTime = 0;
    };

    // Funzione helper per determinare il percorso precedente
    const getPreviousPath = (currentPath: string): string | null => {
    const pathMap: { [key: string]: string } = {
      '/menu': '/',
      '/profilo': '/menu',
      '/menu/profilo': '/menu',
        '/opinioni': '/menu',
        '/rappresentanti': '/menu',
        '/governo': '/menu',
        '/elezioni': '/menu',
        '/ice': '/menu',
        '/iniziative-popolari': '/menu',
        '/referendum-abrogativi': '/menu',
        '/grazia': '/menu',
        '/amnistia': '/menu',
        '/capo-stato': '/menu',
        '/sondaggi': '/menu',
        '/comunicazioni': '/menu',
        '/eventi': '/menu',
        '/notifiche': '/menu',
        '/auth': '/',
        '/registrazione-nome': '/auth',
        '/registrazione-genere': '/registrazione-nome',
        '/registrazione-cittadinanza': '/registrazione-genere',
        '/registrazione-ruolo': '/registrazione-cittadinanza',
        '/registrazione-2-dati': '/registrazione-ruolo',
        '/registrazione-3-opinioni': '/registrazione-2-dati',
        '/registrazione-4-avatar': '/registrazione-3-opinioni',
        '/registrazione-5-conferma': '/registrazione-4-avatar'
      };
      
      return pathMap[currentPath] || null;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [setLocation]);
}

export default function App() {
  // Hook per la navigazione touch
  useTouchNavigation();
  
  // Hook per la navigazione del browser
  useBrowserNavigation();
  
  const [location] = useLocation();
  
  // Debug logging rimosso per evitare re-render

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App">
        <AuthProvider>
          <RegistrationProvider>
            <AppWrapper>
            <Switch>
              {/* Route di verifica email - fuori dall'AuthProvider */}
              <Route path="/verifica-email">
                <PageTransition location={location} type="fade-up">
                  <VerificaEmailStandalone />
                </PageTransition>
              </Route>

              <Route path="/conferma-email">
                <PageTransition location={location} type="fade-up">
                  <ConfermaEmail />
                </PageTransition>
              </Route>
                {/* Route principale */}
                <Route path="/">
                  <PageTransition location={location} type="fade-up" delay={100}>
                    <LandingPage />
                  </PageTransition>
                </Route>

                {/* Route di autenticazione */}
                <Route path="/auth">
                  <PageTransition location={location} type="fade-up">
                    <AuthPage />
                  </PageTransition>
                </Route>

                <Route path="/privacy-policy">
                  <PageTransition location={location} type="fade-up">
                    <PrivacyPolicy />
                  </PageTransition>
                </Route>

                <Route path="/terms-of-service">
                  <PageTransition location={location} type="fade-up">
                    <TermsOfService />
                  </PageTransition>
                </Route>

                <Route path="/cookie-policy">
                  <PageTransition location={location} type="fade-up">
                    <CookiePolicy />
                  </PageTransition>
                </Route>

                <Route path="/security-measures">
                  <PageTransition location={location} type="fade-up">
                    <SecurityMeasures />
                  </PageTransition>
                </Route>

                <Route path="/gdpr-rights">
                  <PageTransition location={location} type="fade-up">
                    <GDPRRights />
                  </PageTransition>
                </Route>
                <Route path="/data-retention">
                  <PageTransition location={location} type="fade-up">
                    <DataRetention />
                  </PageTransition>
                </Route>
                <Route path="/violations-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <ViolationsDashboard />
                  </PageTransition>
                </Route>
                <Route path="/security-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <SecurityDashboard />
                  </PageTransition>
                </Route>
                <Route path="/legal-documents">
                  <PageTransition location={location} type="fade-up">
                    <LegalDocuments />
                  </PageTransition>
                </Route>
                <Route path="/backup-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <BackupDashboard />
                  </PageTransition>
                </Route>
                <Route path="/rate-limiting-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <RateLimitingDashboard />
                  </PageTransition>
                </Route>
                <Route path="/validation-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <ValidationDashboard />
                  </PageTransition>
                </Route>
                <Route path="/logging-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <LoggingDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/audit-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <AuditDashboard />
                  </PageTransition>
                </Route>

                {/* Route per Dashboard Sicurezza e Monitoraggio */}
                <Route path="/admin/security-dashboard">
                  <PageTransition location={location} type="fade-up">
                    <AdminSecurityDashboard />
                  </PageTransition>
                </Route>

                {/* Route per Gestione GDPR e Legale */}
                <Route path="/admin/gdpr-legal">
                  <PageTransition location={location} type="fade-up">
                    <GDPRLegalManagement />
                  </PageTransition>
                </Route>

              {/* Route per le pagine di registrazione separate */}
              <Route path="/registrazione-nome">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneNome />
                </PageTransition>
              </Route>

              <Route path="/registrazione-genere">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneGenere />
                </PageTransition>
              </Route>

              <Route path="/registrazione-cittadinanza">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneCittadinanza />
                </PageTransition>
              </Route>

              <Route path="/registrazione-data-nascita">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneDataNascita />
                </PageTransition>
              </Route>



              <Route path="/registrazione-3-residenza">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneResidenza />
                </PageTransition>
              </Route>

              <Route path="/registrazione-ruolo">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneRuolo />
                </PageTransition>
              </Route>



              {/* Route reset password */}
              <Route path="/reset-password">
                <PageTransition location={location} type="fade-up">
                  <ResetPasswordPage />
                </PageTransition>
              </Route>

              <Route path="/reset-password-confirm">
                <PageTransition location={location} type="fade-up">
                  <ResetPasswordConfirmPage />
                </PageTransition>
              </Route>

              {/* Route del menu principale */}
              <Route path="/menu">
                {console.log('🎯 App - Route /menu matchata!')}
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/menu" component={Menu} />
                </PageTransition>
              </Route>

              {/* Route del profilo - URL diretto */}
              <Route path="/profilo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/profilo" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo - URL con menu */}
              <Route path="/menu/profilo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/menu/profilo" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo utente specifico - URL diretto */}
              <Route path="/profilo/:userId">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/profilo/:userId" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo utente specifico - URL con menu */}
              <Route path="/menu/profilo/:userId">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/menu/profilo/:userId" component={Profilo} />
                </PageTransition>
              </Route>

              <Route path="/modifica-immagine">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/modifica-immagine" component={ModificaImmagine} />
                </PageTransition>
              </Route>

              {/* Route opinioni */}
              <Route path="/opinioni">
                <PageTransition location={location} type="fade-side">
                  <ProtectedRoute path="/opinioni" component={Opinioni} />
                </PageTransition>
              </Route>

              <Route path="/opinioni-nazionali">
                <PageTransition location={location} type="fade-side">
                  <ProtectedRoute path="/opinioni-nazionali" component={OpinioniNazionali} />
                </PageTransition>
              </Route>

              <Route path="/opinioni-regionali">
                <PageTransition location={location} type="fade-side">
                  <ProtectedRoute path="/opinioni-regionali" component={OpinioniRegionali} />
                </PageTransition>
              </Route>

              <Route path="/opinioni-comunali">
                <PageTransition location={location} type="fade-side">
                  <ProtectedRoute path="/opinioni-comunali" component={OpinioniComunali} />
                </PageTransition>
              </Route>

              {/* Route rappresentanti */}
              <Route path="/rappresentanti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/rappresentanti" component={Rappresentanti} />
                </PageTransition>
              </Route>

              {/* Route preferiti */}
              <Route path="/preferiti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/preferiti" component={Preferiti} />
                </PageTransition>
              </Route>

              {/* Route candidati */}
              <Route path="/candidati">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/candidati" component={Candidati} />
                </PageTransition>
              </Route>

              {/* Route attivisti */}
              <Route path="/attivisti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/attivisti" component={Attivisti} />
                </PageTransition>
              </Route>

              {/* Route organizzazioni */}
              <Route path="/organizzazioni">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/organizzazioni" component={Organizzazioni} />
                </PageTransition>
              </Route>

              {/* Route scegli rappresentante - identica a candidati */}
              <Route path="/scegli-rappresentante/:categoria">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/scegli-rappresentante/:categoria" component={ScegliRappresentante} />
                </PageTransition>
              </Route>

      {/* Route candidati - COPIA IDENTICA DI RAPPRESENTANTI */}
      <Route path="/candidati">
        <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
          <ProtectedRoute path="/candidati" component={Candidati} />
        </PageTransition>
      </Route>

      {/* Route scegli candidato */}
      <Route path="/candidati/:categoria">
        <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
          <ProtectedRoute path="/candidati/:categoria" component={ScegliCandidato} />
        </PageTransition>
      </Route>



              {/* Route notifiche */}
              <Route path="/notifiche">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/notifiche" component={Notifiche} />
                </PageTransition>
              </Route>

              {/* Route vota */}
              <Route path="/vota">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/vota" component={Vota} />
                </PageTransition>
              </Route>


              {/* Route eventi */}
              <Route path="/eventi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/eventi" component={Eventi} />
                </PageTransition>
              </Route>

              {/* Route strumenti */}
              <Route path="/strumenti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/strumenti" component={Strumenti} />
                </PageTransition>
              </Route>

              {/* Route gestisci */}
              <Route path="/gestisci">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci" component={Gestisci} />
                </PageTransition>
              </Route>

              {/* Route impostazioni */}
              <Route path="/impostazioni">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni" component={Impostazioni} />
                </PageTransition>
              </Route>

              {/* Route segnala problema */}
              <Route path="/segnala-problema">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/segnala-problema" component={SegnalaProblema} />
                </PageTransition>
              </Route>

              {/* Route sottopagine impostazioni */}
              <Route path="/impostazioni/scarica-dati">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/scarica-dati" component={ScaricaDati} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/cancella-account">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/cancella-account" component={CancellaAccount} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/gestione-privacy">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/gestione-privacy" component={GestionePrivacy} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/limitazione-trattamento">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/limitazione-trattamento" component={LimitazioneTrattamento} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/opposizione-trattamento">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/opposizione-trattamento" component={OpposizioneTrattamento} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/copyright">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni/copyright" component={Copyright} />
                </PageTransition>
              </Route>

              {/* Route GDPR */}
              <Route path="/gdpr">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gdpr" component={GDPR} />
                </PageTransition>
              </Route>

              {/* Route sondaggi */}
              <Route path="/sondaggi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/sondaggi" component={Sondaggi} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per regione */}
              <Route path="/sondaggi/:regione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/sondaggi/:regione" component={SondaggiRegione} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per provincia */}
              <Route path="/sondaggi/:regione/:provincia">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/sondaggi/:regione/:provincia" component={SondaggiProvincia} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per comune */}
              <Route path="/sondaggi/:regione/:provincia/:comune">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/sondaggi/:regione/:provincia/:comune" component={SondaggiComune} />
                </PageTransition>
              </Route>

              {/* Route proponi */}
              <Route path="/proponi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/proponi" component={Proponi} />
                </PageTransition>
              </Route>

              {/* Route proponi opinione */}
              <Route path="/proponi-opinione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/proponi-opinione" component={ProponiOpinione} />
                </PageTransition>
              </Route>

              {/* Route capo di stato */}
              <Route path="/capo-stato">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/capo-stato" component={CapodiStato} />
                </PageTransition>
              </Route>

              {/* Route capo di stato (alternativa) */}
              <Route path="/capo-di-stato">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/capo-di-stato" component={CapodiStato} />
                </PageTransition>
              </Route>

              {/* Route amnistia */}
              <Route path="/amnistia">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/amnistia" component={Amnistia} />
                </PageTransition>
              </Route>

              {/* Route grazia */}
              <Route path="/grazia">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/grazia" component={Grazia} />
                </PageTransition>
              </Route>

              {/* Route governo */}
              <Route path="/governo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/governo" component={Governo} />
                </PageTransition>
              </Route>

              {/* Route ministeri specifici */}
              <Route path="/governo/:slug">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/governo/:slug" component={MinisteroPage} />
                </PageTransition>
              </Route>

              {/* Route ICE */}
              <Route path="/ice">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/ice" component={ICE} />
                </PageTransition>
              </Route>

              {/* Route referendum abrogativi */}
              <Route path="/referendum-abrogativi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/referendum-abrogativi" component={ReferendumAbrogativi} />
                </PageTransition>
              </Route>

              {/* Route iniziative popolari */}
              <Route path="/iniziative-popolari">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/iniziative-popolari" component={IniziativePopolare} />
                </PageTransition>
              </Route>

              {/* Route gestisci utenti */}
              <Route path="/gestisci-utenti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-utenti" component={GestisciUtenti} />
                </PageTransition>
              </Route>

              {/* Route gestisci elezioni */}
              <Route path="/gestisci-elezioni">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-elezioni" component={GestisciElezioni} />
                </PageTransition>
              </Route>

              {/* Route gestisci grazia */}
              <Route path="/gestisci-grazia">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-grazia" component={GestisciGrazia} />
                </PageTransition>
              </Route>

              {/* Route gestisci opinioni */}
              <Route path="/gestisci-opinioni">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-opinioni" component={GestisciOpinioni} />
                </PageTransition>
              </Route>

              {/* Route approfondimento (pubblica) */}
              <Route path="/approfondimento">
                <PageTransition location={location} type="fade-up">
                  <Approfondimento />
                </PageTransition>
              </Route>

              {/* Route gestisci iniziative popolari */}
              <Route path="/gestisci-iniziative-popolari">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-iniziative-popolari" component={GestisciIniziativePopolari} />
                </PageTransition>
              </Route>

              {/* Route gestisci referendum abrogativi */}
              <Route path="/gestisci-referendum-abrogativi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-referendum-abrogativi" component={GestisciReferendumAbrogativi} />
                </PageTransition>
              </Route>

              {/* Route gestisci ICE */}
              <Route path="/gestisci-ice">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-ice" component={GestisciICE} />
                </PageTransition>
              </Route>

              {/* Route gestisci governo */}
              <Route path="/gestisci-governo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/gestisci-governo" component={GestisciGoverno} />
                </PageTransition>
              </Route>

              {/* Route statistiche utenti */}
              <Route path="/statistiche-utenti">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/statistiche-utenti" component={StatisticheUtenti} />
                </PageTransition>
              </Route>

              {/* Route statistiche opinione */}
              <Route path="/statistiche-opinione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/statistiche-opinione" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route statistiche opinione specifica */}
              <Route path="/statistiche-opinione/:id">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/statistiche-opinione/:id" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route statistiche opinione per regione */}
              <Route path="/statistiche-opinione/:id/regione/:regione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/statistiche-opinione/:id/regione/:regione" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route vota iniziativa popolare */}
              <Route path="/vota-iniziativa-popolare">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/vota-iniziativa-popolare" component={VotaIniziativaPopolare} />
                </PageTransition>
              </Route>

              {/* Route vota referendum abrogativo */}
              <Route path="/vota-referendum-abrogativo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/vota-referendum-abrogativo" component={VotaReferendumAbrogativo} />
                </PageTransition>
              </Route>

              {/* Route vota ICE */}
              <Route path="/vota-ice">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/vota-ice" component={VotaICE} />
                </PageTransition>
              </Route>

              {/* Route votazione */}
              <Route path="/votazione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/votazione" component={Votazione} />
                </PageTransition>
              </Route>


              {/* Route sostenitori */}
              <Route path="/sostenitori">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/sostenitori" component={Sostenitori} />
                </PageTransition>
              </Route>

              {/* Route comunica */}
              <Route path="/comunica">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/comunica" component={Comunica} />
                </PageTransition>
              </Route>

              {/* Route evento */}
              <Route path="/evento">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/evento" component={Evento} />
                </PageTransition>
              </Route>

              {/* Route programma */}
              <Route path="/programma">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/programma" component={Programma} />
                </PageTransition>
              </Route>

              {/* Route riscontro */}
              <Route path="/riscontro">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/riscontro" component={Riscontro} />
                </PageTransition>
              </Route>

              {/* Route opinioni europee */}
              <Route path="/opinioni-europee">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/opinioni-europee" component={OpinioniEuropee} />
                </PageTransition>
              </Route>

              {/* Route proponi referendum abrogativi */}
              <Route path="/proponi-referendum-abrogativi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/proponi-referendum-abrogativi" component={ProponiReferendumAbrogativi} />
                </PageTransition>
              </Route>

              {/* Route proponi iniziativa popolare */}
              <Route path="/proponi-iniziativa-popolare">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/proponi-iniziativa-popolare" component={ProponiIniziativaPopolare} />
                </PageTransition>
              </Route>

              {/* Route proponi ICE */}
              <Route path="/proponi-ice">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/proponi-ice" component={ProponiICE} />
                </PageTransition>
              </Route>
            </Switch>
            
            {/* Navbar condizionale */}
            {location !== '/' && 
             !location.startsWith('/auth') && 
             !location.startsWith('/reset-password') && 
             !location.startsWith('/registrazione') && 
             !location.startsWith('/verifica-email') && 
             !location.startsWith('/conferma-email') && 
             !location.startsWith('/privacy-policy') && 
             !location.startsWith('/terms-of-service') && 
             !location.startsWith('/cookie-policy') && 
             location !== '/gdpr' &&
             <Navbar />}
            
            <Toaster />
            <PWAInstallBanner />
            </AppWrapper>
          </RegistrationProvider>
        </AuthProvider>
      </div>
    </QueryClientProvider>
  );
}
