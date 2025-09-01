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
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute  component={pageComponents.Sondaggi} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi regione */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute  component={pageComponents.SondaggiRegione} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi provincia */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute  component={pageComponents.SondaggiProvincia} />
          </PageTransition>
        )}
      </Route>

      {/* Route sondaggi comune */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute  component={pageComponents.SondaggiComune} />
          </PageTransition>
        )}
      </Route>

      {/* Route statistiche opinione */}
      <Route >
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute  component={pageComponents.StatisticheOpinione} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
