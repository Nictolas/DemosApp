import { Route } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

interface FeatureRoutesProps {
  location: string;
}

export const FeatureRoutes = ({ location }: FeatureRoutesProps) => {
  return (
    <>
      {/* Route rappresentanti */}
      <Route path="/rappresentanti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Rappresentanti} />
          </PageTransition>
        )}
      </Route>

      {/* Route elezioni */}
      <Route path="/elezioni">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Elezioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route scegli rappresentante */}
      <Route path="/scegli-rappresentante">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.ScegliRappresentante} />
          </PageTransition>
        )}
      </Route>

      {/* Route scegli candidato */}
      <Route path="/scegli-candidato">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.ScegliCandidato} />
          </PageTransition>
        )}
      </Route>

      {/* Route statistiche utenti */}
      <Route path="/statistiche-utenti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.StatisticheUtenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route strumenti/comunica */}
      <Route path="/strumenti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Strumenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route podio trasparenza */}
      <Route path="/podio-trasparenza">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.PodioTrasparenza} />
          </PageTransition>
        )}
      </Route>

      {/* Route notifiche */}
      <Route path="/notifiche">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Notifiche} />
          </PageTransition>
        )}
      </Route>

      {/* Route capo di stato */}
      <Route path="/capo-di-stato">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.CapodiStato} />
          </PageTransition>
        )}
      </Route>

      {/* Route governo */}
      <Route path="/governo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Governo} />
          </PageTransition>
        )}
      </Route>

      {/* Route grazia */}
      <Route path="/grazia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Grazia} />
          </PageTransition>
        )}
      </Route>

      {/* Route amnistia */}
      <Route path="/amnistia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Amnistia} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota */}
      <Route path="/vota">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Vota} />
          </PageTransition>
        )}
      </Route>

      {/* Route eventi */}
      <Route path="/eventi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Eventi} />
          </PageTransition>
        )}
      </Route>

      {/* Route proponi */}
      <Route path="/proponi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Proponi} />
          </PageTransition>
        )}
      </Route>

      {/* Route iniziative popolari */}
      <Route path="/iniziative-popolari">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.IniziativePopolare} />
          </PageTransition>
        )}
      </Route>

      {/* Route referendum abrogativi */}
      <Route path="/referendum-abrogativi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.ReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>

      {/* Route sostenitori */}
      <Route path="/sostenitori">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Sostenitori} />
          </PageTransition>
        )}
      </Route>

      {/* Route impostazioni */}
      <Route path="/impostazioni">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.Impostazioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route reclama profilo */}
      <Route path="/reclama-profilo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute component={pageComponents.ReclamaProfilo} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
