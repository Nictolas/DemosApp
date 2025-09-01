import { Route } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

interface ManagementRoutesProps {
  location: string;
}

export const ManagementRoutes = ({ location }: ManagementRoutesProps) => {
  return (
    <>
      {/* Route di gestione utenti */}
      <Route path="/gestisci-utenti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-utenti" component={pageComponents.GestisciUtenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione elezioni */}
      <Route path="/gestisci-elezioni">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-elezioni" component={pageComponents.GestisciElezioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione opinioni */}
      <Route path="/gestisci-opinioni">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-opinioni" component={pageComponents.GestisciOpinioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione grazia */}
      <Route path="/gestisci-grazia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-grazia" component={pageComponents.GestisciGrazia} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione iniziative popolari */}
      <Route path="/gestisci-iniziative-popolari">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-iniziative-popolari" component={pageComponents.GestisciIniziativePopolari} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione referendum abrogativi */}
      <Route path="/gestisci-referendum-abrogativi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-referendum-abrogativi" component={pageComponents.GestisciReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione governo */}
      <Route path="/gestisci-governo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-governo" component={pageComponents.GestisciGoverno} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione ICE */}
      <Route path="/gestisci-ice">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci-ice" component={pageComponents.GestisciICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione generale */}
      <Route path="/gestisci">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute path="/gestisci" component={pageComponents.Gestisci} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
