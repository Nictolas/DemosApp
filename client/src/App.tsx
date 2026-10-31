import React, { useEffect } from "react";
import { Route, Switch, useLocation, Redirect, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { WebAppUpdateNotice } from "@/components/WebAppUpdateNotice";
import { AuthProvider } from "@/hooks/use-auth";
import { RegistrationProvider } from "@/hooks/use-registration";
import { useSyncFcmToken } from "@/hooks/useSyncFcmToken";
import { queryClient } from "./lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";

// Import dei componenti principali
import LandingPage from "./pages/LandingPage";
import ScopriDemos from "./pages/ScopriDemos";
import AuthPage from "./pages/auth-page";

// Import delle pagine di registrazione separate
import RegistrazioneNome from "./pages/registrazione-nome";
import RegistrazioneGenere from "./pages/registrazione-genere";
import RegistrazioneCittadinanza from "./pages/registrazione-cittadinanza";
import RegistrazioneDataNascita from "./pages/registrazione-data-nascita";
import RegistrazioneResidenza from "./pages/registrazione-3-residenza";
import RegistrazioneConsensiWizard from "./pages/registrazione-consensi";
import RegistrazioneCreaPasskey from "./pages/registrazione-crea-passkey";
import Profilo from "./pages/Profilo";
import Impostazioni from "./pages/Impostazioni";
import SegnalaProblema from "./pages/SegnalaProblema";
import Avvistamenti from "./pages/Avvistamenti";
import ScaricaDati from "./pages/Impostazioni/ScaricaDati";
import CancellaAccount from "./pages/Impostazioni/CancellaAccount";
import GestionePrivacy from "./pages/Impostazioni/GestionePrivacy";
import LimitazioneTrattamento from "./pages/Impostazioni/LimitazioneTrattamento";
import OpposizioneTrattamento from "./pages/Impostazioni/OpposizioneTrattamento";
import Copyright from "./pages/Impostazioni/Copyright";
import InformazioniLegali from "./pages/Impostazioni/InformazioniLegali";
import CambiaPassword from "./pages/Impostazioni/Password";
import GDPR from "./pages/GDPR";
import Opinioni from "./pages/Opinioni";
import OpinioniNazionali from "./pages/OpinioniNazionali";
import OpinioniRegionali from "./pages/OpinioniRegionali";
import OpinioniComunali from "./pages/OpinioniComunali";
import Rappresentanti from "./pages/Rappresentanti";
import ScegliRappresentante from "./pages/ScegliRappresentante";
import Preferiti from "./pages/Preferiti";
import Candidati from "./pages/Candidati";
import Attivisti from "./pages/Attivisti";
import Siti from "./pages/Siti";
import Social from "./pages/Social";
import Organizzazioni from "./pages/Organizzazioni";
import Notifiche from "./pages/Notifiche";
import NotifichePreferenze from "./pages/NotifichePreferenze";
import NotificheDemos from "./pages/NotificheDemos";
import NotificheTotali from "./pages/NotificheTotali";
import Vota from "./pages/Vota";
import Eventi from "./pages/Eventi";
import Gestisci from "./pages/Gestisci";
import ProposteSoggetti from "./pages/Gestisci/ProposteSoggetti";
import Strumenti from "./pages/Strumenti";
import Sondaggi from "./pages/Sondaggi";
import Proponi from "./pages/Proponi";
import ProponiSoggetto from "./pages/ProponiSoggetto";
import ProponiOpinione from "./pages/ProponiOpinione";
import CapodiStato from "./pages/CapodiStato";
import Amnistia from "./pages/Amnistia";
import Grazia from "./pages/Grazia";
import Governo from "./pages/Governo";
import MinisteroPage from "./pages/Governo/[slug]";
import ICE from "./pages/ICE";
import ReferendumAbrogativi from "./pages/ReferendumAbrogativi";
import IniziativePopolari from "./pages/IniziativePopolari";
import GestisciOpinioni from "./pages/GestisciOpinioni";
import GestisciGrazia from "./pages/GestisciGrazia";
import TestMinistero from "./pages/TestMinistero";
import ModificaImmagine from "./pages/ModificaImmagine";
import Utenti from "./pages/Utenti";
import StatisticheOpinione from "./pages/StatisticheOpinione";
import SondaggiRegione from "./pages/SondaggiRegione";
import SondaggiProvincia from "./pages/SondaggiProvincia";
import SondaggiComune from "./pages/SondaggiComune";
import VotaIniziativaPopolare from "./pages/VotaIniziativaPopolare";
import VotaICE from "./pages/VotaICE";
import Votazione from "./pages/Votazione";
import Sostenitori from "./pages/Sostenitori";
import VotiPolitici from "./pages/VotiPolitici";
import VotiParlamento from "./pages/VotiParlamento";
import VotiParlamentoEuropeo from "./pages/VotiParlamentoEuropeo";
import ECI from "./pages/ECI";
import Comunica from "./pages/Comunica";
import Evento from "./pages/Evento";
import Programma from "./pages/Programma";
import InformaCittadini from "./pages/InformaCittadini";
import Riscontro from "./pages/Riscontro";
import OpinioniEuropee from "./pages/OpinioniEuropee";
import ProponiReferendumAbrogativi from "./pages/ProponiReferendumAbrogativi";
import ProponiIniziativaPopolare from "./pages/ProponiIniziativaPopolare";
import ProponiICE from "./pages/ProponiICE";
import Riconoscimento from "./pages/Riconoscimento";
import Riconoscimenti from "./pages/Riconoscimenti";
import RiduzioneCompute from "./pages/RiduzioneCompute";
import MetricheEndpoint from "./pages/MetricheEndpoint";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiePolicy from "./pages/CookiePolicy";
import ChildSafetyStandards from "./pages/ChildSafetyStandards";
import Accessibilita from "./pages/Accessibilita";
import RegistroTrattamenti from "./pages/RegistroTrattamenti";
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
import OpsCenter from "./pages/Admin/OpsCenter";
import Parametri from "./pages/Admin/Parametri";
import DpoPanel from "./pages/DpoPanel";
import GDPRLegalManagement from "./pages/Admin/GDPRLegalManagement";
import DataExport from "./pages/DataExport";
import CentralizedLogs from "./pages/CentralizedLogs";
import Axiom from "./pages/Axiom";
import Approfondimento from "./pages/Approfondimento";
import Navbar from "./components/Navbar";
import { useBrowserNavigation } from "./hooks/useBrowserNavigation";
import { AppWrapper } from "./components/AppWrapper";
import { ViewModeProvider } from "@/hooks/useViewMode";
import { MobilePreviewShell } from "@/components/MobilePreviewShell";
import { MobilePreviewToggle } from "@/components/MobilePreviewToggle";
import { RobustAppLayout } from "./components/RobustAppLayout";

// Hook per la navigazione touch migliorato
function useTouchNavigation() {
  const [, setLocation] = useLocation();
  
  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isScrolling = false;
    let touchStartTime = 0;
    let isNavigating = false;

    // Le aree con scorrimento orizzontale autonomo devono restare fuori
    // dalla navigazione globale swipe-back di DEMOS.
    const isLocalHorizontalSwipe = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest('[data-horizontal-swipe-region="true"]');

    const handleTouchStart = (e: TouchEvent) => {
      if (isLocalHorizontalSwipe(e.target)) {
        startX = 0;
        startY = 0;
        isScrolling = true;
        return;
      }
      // Evita conflitti se già in navigazione
      if (isNavigating) return;
      
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isScrolling = false;
      touchStartTime = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isLocalHorizontalSwipe(e.target)) return;
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
            // Fallback: vai alla home (preferiti per utenti autenticati)
            setLocation('/preferiti');
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
      '/menu': '/preferiti',
      '/preferiti': '/',
      '/profilo': '/preferiti',
      '/menu/profilo': '/preferiti',
        '/opinioni': '/preferiti',
        '/rappresentanti': '/preferiti',
        '/governo': '/preferiti',
        '/elezioni': '/preferiti',
        '/ice': '/preferiti',
        '/eci': '/preferiti',
        '/iniziative-popolari': '/preferiti',
        '/referendum-abrogativi': '/preferiti',
        '/grazia': '/preferiti',
        '/amnistia': '/preferiti',
        '/capo-stato': '/preferiti',
        '/sondaggi': '/preferiti',
        '/comunicazioni': '/preferiti',
        '/eventi': '/preferiti',
        '/notifiche': '/preferiti',
        '/auth': '/',
        '/registrazione-nome': '/auth',
        '/registrazione-consensi-privacy': '/auth',
        '/registrazione-consensi-termini': '/registrazione-consensi-privacy',
        '/registrazione-consensi-opinioni': '/registrazione-consensi-termini',
        '/registrazione-crea-passkey': '/registrazione-3-residenza',
        '/registrazione-genere': '/registrazione-nome',
        '/registrazione-cittadinanza': '/registrazione-genere',
        '/registrazione-2-dati': '/registrazione-cittadinanza',
        '/registrazione-3-residenza': '/registrazione-2-dati',
        '/registrazione-3-opinioni': '/registrazione-2-dati',
        '/registrazione-4-avatar': '/registrazione-3-opinioni',
        '/registrazione-5-conferma': '/registrazione-4-avatar'
      };
      let prev = pathMap[currentPath];
      if (typeof window !== 'undefined') {
        // Flusso passkey: da genere si torna ai consensi (non a nome)
        if (currentPath === '/registrazione-genere' && window.localStorage.getItem('registrazione_passkey_flow'))
          prev = '/registrazione-consensi-opinioni';
        // Utente già con passkey: da genere si torna ad /auth
        else if (currentPath === '/registrazione-genere' && window.localStorage.getItem('webauthn_user_id'))
          prev = '/auth';
      }
      return prev ?? null;
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
      <WebAppUpdateNotice />
      <ViewModeProvider>
        <MobilePreviewShell>
          <div className="App">
            <AuthProvider>
              <FCMTokenSync />
              <RegistrationProvider>
                <RobustAppLayout>
                  <AppWrapper>
              <Switch>
                {/* Homepage: presentazione + login */}
                <Route path="/">
                  <PageTransition location={location} type="fade-up">
                    <LandingPage />
                  </PageTransition>
                </Route>

                {/* Alias esplicito per /auth (per link legacy) */}
                <Route path="/auth">
                  <PageTransition location={location} type="fade-up">
                    <AuthPage />
                  </PageTransition>
                </Route>

                <Route path="/scopri-demos">
                  <PageTransition location={location} type="fade-up">
                    <ScopriDemos />
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

                <Route path="/standard-sicurezza-minori">
                  <PageTransition location={location} type="fade-up">
                    <ChildSafetyStandards />
                  </PageTransition>
                </Route>

                <Route path="/accessibilita">
                  <PageTransition location={location} type="fade-up">
                    <Accessibilita />
                  </PageTransition>
                </Route>

                <Route path="/registro-trattamenti">
                  <PageTransition location={location} type="fade-up">
                    <RegistroTrattamenti />
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
                  <Redirect to="/monitoring-dashboard/overview" />
                </Route>
                <Route path="/monitoring-dashboard/overview">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/health">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/performance">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/disk">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/database">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/memory">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/security">
                  <PageTransition location={location} type="fade-up">
                    <MonitoringDashboard />
                  </PageTransition>
                </Route>
                <Route path="/monitoring-dashboard/services">
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
                  <Redirect to="/admin/ops-center" />
                </Route>
                <Route path="/admin/ops-center">
                  <PageTransition location={location} type="fade-up">
                    <OpsCenter />
                  </PageTransition>
                </Route>
                <Route path="/admin/ops-center/:section">
                  <Redirect to="/admin/ops-center" />
                </Route>
                <Route path="/admin/parametri">
                  <PageTransition location={location} type="fade-up">
                    <Parametri />
                  </PageTransition>
                </Route>

                {/* Route per Gestione GDPR e Legale */}
                <Route path="/dpo">
                  <PageTransition location={location} type="fade-up">
                    <DpoPanel />
                  </PageTransition>
                </Route>
                <Route path="/admin/gdpr-legal">
                  <PageTransition location={location} type="fade-up">
                    <GDPRLegalManagement />
                  </PageTransition>
                </Route>

                {/* Route per Export Dati */}
                <Route path="/admin/data-export">
                  <PageTransition location={location} type="fade-up">
                    <DataExport />
                  </PageTransition>
                </Route>

                {/* Route per Log Centralizzati */}
                <Route path="/admin/data-export/centralized-logs">
                  <PageTransition location={location} type="fade-up">
                    <CentralizedLogs />
                  </PageTransition>
                </Route>

                {/* Route per Dati Axiom */}
                <Route path="/admin/data-export/axiom">
                  <PageTransition location={location} type="fade-up">
                    <Axiom />
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

              {/* Nuovo wizard per i 3 consensi (Privacy, Termini, Opinioni) */}
              <Route path="/registrazione-consensi">
                <PageTransition location={location} type="fade-side">
                  <RegistrazioneConsensiWizard />
                </PageTransition>
              </Route>

              {/* Route legacy: reindirizzano al wizard, mantenute per compatibilità */}
              <Route path="/registrazione-consensi-privacy">
                <Redirect to="/registrazione-consensi" />
              </Route>
              <Route path="/registrazione-consensi-termini">
                <Redirect to="/registrazione-consensi" />
              </Route>
              <Route path="/registrazione-consensi-opinioni">
                <Redirect to="/registrazione-consensi" />
              </Route>
              <Route path="/registrazione-crea-passkey">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneCreaPasskey />
                </PageTransition>
              </Route>

              <Route path="/registrazione-3-residenza">
                <PageTransition location={location} type="fade-up">
                  <RegistrazioneResidenza />
                </PageTransition>
              </Route>
              {/* URL legacy: il Menu non è pubblico, reindirizza ai Preferiti. */}
              <Route path="/menu">
                <Redirect to="/preferiti" />
              </Route>

              {/* Route del profilo - URL diretto */}
              <Route path="/profilo">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/profilo" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo - URL con menu */}
              <Route path="/menu/profilo">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/menu/profilo" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo utente specifico - URL diretto */}
              <Route path="/profilo/:userId">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/profilo/:userId" component={Profilo} />
                </PageTransition>
              </Route>

              {/* Route del profilo utente specifico - URL con menu */}
              <Route path="/menu/profilo/:userId">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/menu/profilo/:userId" component={Profilo} />
                </PageTransition>
              </Route>

              <Route path="/modifica-immagine">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/modifica-immagine" component={ModificaImmagine} />
                </PageTransition>
              </Route>

              {/* Route opinioni — senza PageTransition (layout ancorato) */}
              <Route path="/opinioni">
                <ProtectedRoute path="/opinioni" component={Opinioni} />
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

              {/* Route rappresentanti — senza PageTransition (layout ancorato) */}
              <Route path="/rappresentanti">
                <ProtectedRoute path="/rappresentanti" component={Rappresentanti} />
              </Route>

              {/* Route preferiti — senza PageTransition (evita wrapper che rompe l'altezza) */}
              <Route path="/preferiti">
                <ProtectedRoute path="/preferiti" component={Preferiti} />
              </Route>

              {/* Come Rappresentanti: la griglia occupa direttamente l'altezza
                  della shell, già al netto della navbar. Il wrapper PageTransition
                  non ha altezza esplicita e comprimeva Candidati verso l'alto. */}
              <Route path="/candidati">
                <ProtectedRoute path="/candidati" component={Candidati} />
              </Route>

              {/* Route attivisti - PAGINA PUBBLICA */}
              <Route path="/attivisti">
                <Attivisti />
              </Route>

              {/* Route siti */}
              <Route path="/siti">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/siti" component={Siti} />
                </PageTransition>
              </Route>

              {/* Route social */}
              <Route path="/social">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/social" component={Social} />
                </PageTransition>
              </Route>

              {/* Route organizzazioni */}
              <Route path="/organizzazioni">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/organizzazioni" component={Organizzazioni} />
                </PageTransition>
              </Route>

              {/* Route scegli rappresentante - USA IL COMPONENTE RAPPRESENTANTI */}
              <Route path="/scegli-rappresentante/:categoria">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/scegli-rappresentante/:categoria" component={ScegliRappresentante} />
                </PageTransition>
              </Route>

      {/* Route candidati - COPIA IDENTICA DI RAPPRESENTANTI */}
      <Route path="/candidati">
        <PageTransition location={location} type="fade-up" showLoader={false}>
          <ProtectedRoute path="/candidati" component={Candidati} />
        </PageTransition>
      </Route>

      {/* Route scegli candidato - USA LO STESSO COMPONENTE DEI RAPPRESENTANTI */}
      <Route path="/candidati/:categoria">
        <PageTransition location={location} type="fade-up" showLoader={false}>
          <ProtectedRoute path="/candidati/:categoria" component={ScegliRappresentante} />
        </PageTransition>
      </Route>



              {/* Route notifiche */}
              <Route path="/notifiche">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/notifiche" component={Notifiche} />
                </PageTransition>
              </Route>

              {/* Route preferenze notifiche */}
              <Route path="/notifiche/preferenze">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/notifiche/preferenze" component={NotifichePreferenze} />
                </PageTransition>
              </Route>

              {/* Route notifiche totali */}
              <Route path="/notifiche-totali">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/notifiche-totali" component={NotificheTotali} />
                </PageTransition>
              </Route>

              {/* Route vota */}
              <Route path="/vota">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/vota" component={Vota} />
                </PageTransition>
              </Route>


              {/* Route eventi */}
              <Route path="/eventi">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/eventi" component={Eventi} />
                </PageTransition>
              </Route>

              {/* Route strumenti — senza PageTransition (layout ancorato) */}
              <Route path="/strumenti">
                <ProtectedRoute path="/strumenti" component={Strumenti} />
              </Route>

              {/* Route gestisci */}
              <Route path="/gestisci">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci" component={Gestisci} />
                </PageTransition>
              </Route>

              <Route path="/gestisci/proposte-soggetti">
                <ProtectedRoute path="/gestisci/proposte-soggetti" component={ProposteSoggetti} />
              </Route>

              {/* Route riconoscimenti (admin) */}
              <Route path="/gestisci/riconoscimenti">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci/riconoscimenti" component={Riconoscimenti} />
                </PageTransition>
              </Route>

              {/* Riduzione carico DB Supabase (admin) */}
              <Route path="/gestisci/riduzione-compute">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci/riduzione-compute" component={RiduzioneCompute} />
                </PageTransition>
              </Route>

              <Route path="/gestisci/metriche-endpoint">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci/metriche-endpoint" component={MetricheEndpoint} />
                </PageTransition>
              </Route>

              {/* Route voti politici */}
              <Route path="/voti-politici">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/voti-politici" component={VotiPolitici} />
                </PageTransition>
              </Route>

              {/* Route voti parlamento */}
              <Route path="/voti-parlamento">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/voti-parlamento" component={VotiParlamento} />
                </PageTransition>
              </Route>

              {/* Route voti parlamento europeo */}
              <Route path="/voti-parlamento-europeo">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/voti-parlamento-europeo" component={VotiParlamentoEuropeo} />
                </PageTransition>
              </Route>

              {/* Route notifiche demos */}
              <Route path="/gestisci/notifiche-demos">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci/notifiche-demos" component={NotificheDemos} />
                </PageTransition>
              </Route>

              {/* Route impostazioni — senza PageTransition (layout ancorato) */}
              <Route path="/impostazioni">
                <ProtectedRoute path="/impostazioni" component={Impostazioni} />
              </Route>

              {/* Route riconoscimento singolo utente */}
              <Route path="/riconoscimento">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/riconoscimento" component={Riconoscimento} />
                </PageTransition>
              </Route>

              {/* Route segnala problema */}
              <Route path="/segnala-problema">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/segnala-problema" component={SegnalaProblema} />
                </PageTransition>
              </Route>

              {/* Route avvistamenti */}
              <Route path="/avvistamenti">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/avvistamenti" component={Avvistamenti} />
                </PageTransition>
              </Route>

              {/* Route sottopagine impostazioni */}
              <Route path="/impostazioni/password">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/password" component={CambiaPassword} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/scarica-dati">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/scarica-dati" component={ScaricaDati} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/cancella-account">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/cancella-account" component={CancellaAccount} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/gestione-privacy">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/gestione-privacy" component={GestionePrivacy} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/limitazione-trattamento">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/limitazione-trattamento" component={LimitazioneTrattamento} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/opposizione-trattamento">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/opposizione-trattamento" component={OpposizioneTrattamento} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/copyright">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/copyright" component={Copyright} />
                </PageTransition>
              </Route>

              <Route path="/impostazioni/informazioni-legali">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/impostazioni/informazioni-legali" component={InformazioniLegali} />
                </PageTransition>
              </Route>

              {/* Route GDPR */}
              <Route path="/gdpr">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gdpr" component={GDPR} />
                </PageTransition>
              </Route>

              {/* Route sondaggi */}
              <Route path="/sondaggi">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/sondaggi" component={Sondaggi} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per regione */}
              <Route path="/sondaggi/:regione">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/sondaggi/:regione" component={SondaggiRegione} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per provincia */}
              <Route path="/sondaggi/:regione/:provincia">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/sondaggi/:regione/:provincia" component={SondaggiProvincia} />
                </PageTransition>
              </Route>

              {/* Route sondaggi per comune */}
              <Route path="/sondaggi/:regione/:provincia/:comune">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/sondaggi/:regione/:provincia/:comune" component={SondaggiComune} />
                </PageTransition>
              </Route>

              {/* Route firma */}
              <Route path="/firma">
                <ProtectedRoute path="/firma" component={Proponi} />
              </Route>

              {/* Nuova proposta condivisa: la categoria si sceglie solo nel client. */}
              <Route path="/proponi-soggetto">
                <ProtectedRoute path="/proponi-soggetto" component={ProponiSoggetto} />
              </Route>

              {/* Route proponi opinione */}
              <Route path="/proponi-opinione">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={500}>
                  <ProtectedRoute path="/proponi-opinione" component={ProponiOpinione} />
                </PageTransition>
              </Route>

              {/* Route capo di stato */}
              {/* Capo di Stato — senza PageTransition (layout a tutta altezza su PC) */}
              <Route path="/capo-stato">
                <ProtectedRoute path="/capo-stato" component={CapodiStato} />
              </Route>

              <Route path="/capo-di-stato">
                <ProtectedRoute path="/capo-di-stato" component={CapodiStato} />
              </Route>

              {/* Route amnistia */}
              <Route path="/amnistia">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/amnistia" component={Amnistia} />
                </PageTransition>
              </Route>

              {/* Route grazia */}
              <Route path="/grazia">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={500}>
                  <ProtectedRoute path="/grazia" component={Grazia} />
                </PageTransition>
              </Route>

              {/* Route governo */}
              <Route path="/governo">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/governo" component={Governo} />
                </PageTransition>
              </Route>

              {/* Route ministeri specifici */}
              <Route path="/governo/:slug">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/governo/:slug" component={MinisteroPage} />
                </PageTransition>
              </Route>

              {/* Route ICE */}
              <Route path="/ice">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={500}>
                  <ProtectedRoute path="/ice" component={ICE} />
                </PageTransition>
              </Route>

              {/* Route ECI - Lista ICE e numero firme */}
              <Route path="/eci">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/eci" component={ECI} />
                </PageTransition>
              </Route>

              {/* Route referendum abrogativi */}
              <Route path="/referendum-abrogativi">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={500}>
                  <ProtectedRoute path="/referendum-abrogativi" component={ReferendumAbrogativi} />
                </PageTransition>
              </Route>

              {/* Route iniziative popolari */}
              <Route path="/iniziative-popolari">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={500}>
                  <ProtectedRoute path="/iniziative-popolari" component={IniziativePopolari} />
                </PageTransition>
              </Route>

              {/* Vecchio URL: redirect alla pagina utenti unificata */}
              <Route path="/gestisci-utenti">
                <Redirect to="/utenti" />
              </Route>

              {/* Route utenti unificata */}
              <Route path="/utenti">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/utenti" component={Utenti} />
                </PageTransition>
              </Route>


              {/* Moderazione Grazia separata tramite richieste_grazia. */}
              <Route path="/gestisci-grazia">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci-grazia" component={GestisciGrazia} />
                </PageTransition>
              </Route>

              {/* Route gestisci opinioni */}
              <Route path="/gestisci-opinioni">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/gestisci-opinioni" component={GestisciOpinioni} />
                </PageTransition>
              </Route>

              {/* Route approfondimento (pubblica) */}
              <Route path="/approfondimento">
                <PageTransition location={location} type="fade-up">
                  <Approfondimento />
                </PageTransition>
              </Route>



              {/* Route test ministero */}
              <Route path="/test-ministero">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/test-ministero" component={TestMinistero} />
                </PageTransition>
              </Route>

              {/* Compatibilità: la scheda Statistiche è ora integrata in /utenti */}
              <Route path="/statistiche-utenti">
                <Redirect to="/utenti" />
              </Route>

              {/* Route statistiche opinione */}
              <Route path="/statistiche-opinione">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/statistiche-opinione" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route statistiche opinione specifica */}
              <Route path="/statistiche-opinione/:id">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/statistiche-opinione/:id" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route statistiche opinione per regione */}
              <Route path="/statistiche-opinione/:id/regione/:regione">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/statistiche-opinione/:id/regione/:regione" component={StatisticheOpinione} />
                </PageTransition>
              </Route>

              {/* Route vota iniziativa popolare */}
              <Route path="/vota-iniziativa-popolare">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/vota-iniziativa-popolare" component={VotaIniziativaPopolare} />
                </PageTransition>
              </Route>

              {/* Vecchio URL della priorità referendum: redirect alla raccolta ufficiale */}
              <Route path="/vota-referendum-abrogativo">
                <Redirect to="/referendum-abrogativi" />
              </Route>

              {/* Route vota ICE */}
              <Route path="/vota-ice">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/vota-ice" component={VotaICE} />
                </PageTransition>
              </Route>

              {/* Route comunica (ex /votazione) */}
              <Route path="/comunica">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/comunica" component={Votazione} />
                </PageTransition>
              </Route>

              {/* Route sostenitori */}
              <Route path="/sostenitori">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/sostenitori" component={Sostenitori} />
                </PageTransition>
              </Route>

              {/* Route evento */}
              <Route path="/evento">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/evento" component={Evento} />
                </PageTransition>
              </Route>

              {/* Route informa cittadini */}
              <Route path="/informa-cittadini">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/informa-cittadini" component={InformaCittadini} />
                </PageTransition>
              </Route>

              {/* Route programma */}
              <Route path="/programma">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/programma" component={Programma} />
                </PageTransition>
              </Route>

              {/* Route riscontro */}
              <Route path="/riscontro">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/riscontro" component={Riscontro} />
                </PageTransition>
              </Route>

              {/* Route opinioni europee */}
              <Route path="/opinioni-europee">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/opinioni-europee" component={OpinioniEuropee} />
                </PageTransition>
              </Route>

              {/* Route proponi referendum abrogativi */}
              <Route path="/proponi-referendum-abrogativi">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/proponi-referendum-abrogativi" component={ProponiReferendumAbrogativi} />
                </PageTransition>
              </Route>

              {/* Route proponi iniziativa popolare */}
              <Route path="/proponi-iniziativa-popolare">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/proponi-iniziativa-popolare" component={ProponiIniziativaPopolare} />
                </PageTransition>
              </Route>

              {/* Route proponi ICE */}
              <Route path="/proponi-ice">
                <PageTransition location={location} type="fade-up" showLoader={false}>
                  <ProtectedRoute path="/proponi-ice" component={ProponiICE} />
                </PageTransition>
              </Route>
            </Switch>
            
            <Toaster />
            <PWAInstallBanner />
                  </AppWrapper>
                </RobustAppLayout>
              </RegistrationProvider>
            </AuthProvider>
          </div>
          <MobilePreviewToggle />
        </MobilePreviewShell>
      </ViewModeProvider>
    </QueryClientProvider>
  );
}

// Componente per sincronizzare token FCM quando l'utente è loggato
function FCMTokenSync() {
  useSyncFcmToken();
  return null;
}
