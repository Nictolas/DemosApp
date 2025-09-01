import { Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

export const ManagementRoutes = () => {
  const [location] = useLocation();
  return (
    <>
      {/* Route di gestione utenti */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-utenti" component={pageComponents.GestisciUtenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione elezioni */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-elezioni" component={pageComponents.GestisciElezioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione opinioni */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-opinioni" component={pageComponents.GestisciOpinioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione grazia */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-grazia" component={pageComponents.GestisciGrazia} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione iniziative popolari */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-iniziative-popolari" component={pageComponents.GestisciIniziativePopolari} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione referendum abrogativi */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-referendum-abrogativi" component={pageComponents.GestisciReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione governo */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-governo" component={pageComponents.GestisciGoverno} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione ICE */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-ice" component={pageComponents.GestisciICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione generale */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci" component={pageComponents.Gestisci} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
