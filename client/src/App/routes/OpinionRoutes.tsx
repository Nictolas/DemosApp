import { Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

export const OpinionRoutes = () => {
  const [location] = useLocation();
  return (
    <>
      {/* Route opinioni con parametri dinamici */}
      <Route path="/opinioni/:opinionField/:regionName/:provinceName/:comuneName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName/:provinceName/:comuneName"
              component={() => (
                <pageComponents.DettaglioOpinione 
                  opinionField={params.opinionField} 
                  regionName={params.regionName} 
                  provinceName={params.provinceName} 
                  comuneName={params.comuneName} 
                />
              )} 
            />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni/:opinionField/:regionName/:provinceName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName/:provinceName"
              component={() => (
                <pageComponents.DettaglioOpinione 
                  opinionField={params.opinionField} 
                  regionName={params.regionName} 
                  provinceName={params.provinceName} 
                />
              )} 
            />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni/:opinionField/:regionName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField/:regionName"
              component={() => (
                <pageComponents.DettaglioOpinione 
                  opinionField={params.opinionField} 
                  regionName={params.regionName} 
                />
              )} 
            />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni/:opinionField">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
              path="/opinioni/:opinionField"
              component={() => (
                <pageComponents.DettaglioOpinione 
                  opinionField={params.opinionField} 
                />
              )} 
            />
          </PageTransition>
        )}
      </Route>

      {/* Route opinioni principali */}
      <Route path="/opinioni">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni" component={pageComponents.Opinioni} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-europee">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni-europee" component={pageComponents.OpinioniEuropee} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-nazionali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni-nazionali" component={pageComponents.OpinioniNazionali} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-regionali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni-regionali" component={pageComponents.OpinioniRegionali} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-comunali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute path="/opinioni-comunali" component={pageComponents.OpinioniComunali} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
