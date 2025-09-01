import { Route } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

interface VotingRoutesProps {
  location: string;
}

export const VotingRoutes = ({ location }: VotingRoutesProps) => {
  return (
    <>
      {/* Route ICE */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/ice" component={pageComponents.ICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota ICE */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-ice" component={pageComponents.VotaICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota iniziativa popolare */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-iniziativa-popolare" component={pageComponents.VotaIniziativaPopolare} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota referendum abrogativo */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-referendum-abrogativo" component={pageComponents.VotaReferendumAbrogativo} />
          </PageTransition>
        )}
      </Route>

      {/* Route votazione */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/votazione" component={pageComponents.Votazione} />
          </PageTransition>
        )}
      </Route>

      {/* Route evento */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/evento" component={pageComponents.Evento} />
          </PageTransition>
        )}
      </Route>

      {/* Route programma */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/programma" component={pageComponents.Programma} />
          </PageTransition>
        )}
      </Route>

      {/* Route dona */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/dona" component={pageComponents.Dona} />
          </PageTransition>
        )}
      </Route>

      {/* Route proponi opinione */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/proponi-opinione" component={pageComponents.ProponiOpinione} />
          </PageTransition>
        )}
      </Route>

      {/* Route riscontro */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/riscontro" component={pageComponents.Riscontro} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
