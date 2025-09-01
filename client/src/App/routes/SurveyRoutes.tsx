import { Route } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

interface SurveyRoutesProps {
  location: string;
}

export const SurveyRoutes = ({ location }: SurveyRoutesProps) => {
  return (
    <>
      {/* Route sondaggi */}
      <Route path="/sondaggi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/sondaggi" component={pageComponents.Sondaggi} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi regione */}
      <Route path="/sondaggi-regione">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/sondaggi-regione" component={pageComponents.SondaggiRegione} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi provincia */}
      <Route path="/sondaggi-provincia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/sondaggi-provincia" component={pageComponents.SondaggiProvincia} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi comune */}
      <Route path="/sondaggi-comune">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/sondaggi-comune" component={pageComponents.SondaggiComune} />
          </PageTransition>
        )}
      </Route>

      {/* Route statistiche opinione */}
      <Route path="/statistiche-opinione">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/statistiche-opinione" component={pageComponents.StatisticheOpinione} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
