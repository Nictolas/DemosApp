import React from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth-neon";
import { RegistrationProvider } from "@/hooks/use-registration";
import { queryClient } from "./lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";

// Import dei componenti principali
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/auth-page";
import Menu from "./pages/Menu";
import Profilo from "./pages/Profilo";
import Impostazioni from "./pages/Impostazioni";
import Opinioni from "./pages/Opinioni";
import OpinioniNazionali from "./pages/OpinioniNazionali";
import OpinioniRegionali from "./pages/OpinioniRegionali";
import OpinioniComunali from "./pages/OpinioniComunali";
import Rappresentanti from "./pages/Rappresentanti";
import Notifiche from "./pages/Notifiche";
import Vota from "./pages/Vota";
import Navbar from "./components/Navbar";

// Hook per la navigazione touch
function useTouchNavigation() {
  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isScrolling = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!startX || !startY) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = Math.abs(startX - currentX);
      const diffY = Math.abs(startY - currentY);

      if (diffY > diffX) {
        isScrolling = true;
        return;
      }

      if (diffX > 50 && !isScrolling) {
        const direction = startX > currentX ? 'right' : 'left';
        
        if (direction === 'right') {
          // Swipe da sinistra a destra - vai indietro
          window.history.back();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);
}

export default function App() {
  // Hook per la navigazione touch
  useTouchNavigation();
  
  const [location] = useLocation();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RegistrationProvider>
          <div className="App">
            <Switch>
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

              {/* Route del menu principale */}
              <Route path="/menu">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/menu" component={Menu} />
                </PageTransition>
              </Route>

              {/* Route del profilo */}
              <Route path="/menu/profilo">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/menu/profilo" component={Profilo} />
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

              {/* Route impostazioni */}
              <Route path="/impostazioni">
                <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
                  <ProtectedRoute path="/impostazioni" component={Impostazioni} />
                </PageTransition>
              </Route>
            </Switch>

            {/* Navbar condizionale */}
            {location !== '/' && 
             !location.startsWith('/auth') && 
             <Navbar />}
            
            <Toaster />
          </div>
        </RegistrationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}