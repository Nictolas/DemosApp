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
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciUtenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione elezioni */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciElezioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione opinioni */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciOpinioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione grazia */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciGrazia} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione iniziative popolari */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciIniziativePopolari} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione referendum abrogativi */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione governo */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciGoverno} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione ICE */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.GestisciICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route di gestione generale */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={400}>
            <ProtectedRoute  component={pageComponents.Gestisci} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
