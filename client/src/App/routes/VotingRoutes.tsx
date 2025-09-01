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
      <Route path="/ice">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/ice" component={pageComponents.ICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota ICE */}
      <Route path="/vota-ice">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-ice" component={pageComponents.VotaICE} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota iniziativa popolare */}
      <Route path="/vota-iniziativa-popolare">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-iniziativa-popolare" component={pageComponents.VotaIniziativaPopolare} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota referendum abrogativo */}
      <Route path="/vota-referendum-abrogativo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota-referendum-abrogativo" component={pageComponents.VotaReferendumAbrogativo} />
          </PageTransition>
        )}
      </Route>

      {/* Route votazione */}
      <Route path="/votazione">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/votazione" component={pageComponents.Votazione} />
          </PageTransition>
        )}
      </Route>

      {/* Route evento */}
      <Route path="/evento">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/evento" component={pageComponents.Evento} />
          </PageTransition>
        )}
      </Route>

      {/* Route programma */}
      <Route path="/programma">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/programma" component={pageComponents.Programma} />
          </PageTransition>
        )}
      </Route>

      {/* Route dona */}
      <Route path="/dona">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/dona" component={pageComponents.Dona} />
          </PageTransition>
        )}
      </Route>

      {/* Route proponi opinione */}
      <Route path="/proponi-opinione">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/proponi-opinione" component={pageComponents.ProponiOpinione} />
          </PageTransition>
        )}
      </Route>

      {/* Route riscontro */}
      <Route path="/riscontro">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/riscontro" component={pageComponents.Riscontro} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
