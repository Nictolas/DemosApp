import { Route } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

interface OpinionRoutesProps {
  location: string;
}

export const OpinionRoutes = ({ location }: OpinionRoutesProps) => {
  return (
    <>
      {/* Route opinioni con parametri dinamici */}
      <Route path="/opinioni/:opinionField/:regionName/:provinceName/:comuneName">
        {(params) => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute 
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
            <ProtectedRoute component={pageComponents.Opinioni} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-europee">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute component={pageComponents.OpinioniEuropee} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-nazionali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute component={pageComponents.OpinioniNazionali} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-regionali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute component={pageComponents.OpinioniRegionali} />
          </PageTransition>
        )}
      </Route>

      <Route path="/opinioni-comunali">
        {() => (
          <PageTransition location={location} type="fade-side">
            <ProtectedRoute component={pageComponents.OpinioniComunali} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
