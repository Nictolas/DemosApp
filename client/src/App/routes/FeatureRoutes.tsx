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
            <ProtectedRoute path="/rappresentanti" component={pageComponents.Rappresentanti} />
          </PageTransition>
        )}
      </Route>

      {/* Route elezioni */}
      <Route path="/elezioni">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/elezioni" component={pageComponents.Elezioni} />
          </PageTransition>
        )}
      </Route>

      {/* Route scegli rappresentante */}
      <Route path="/scegli-rappresentante">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/scegli-rappresentante" component={pageComponents.ScegliRappresentante} />
          </PageTransition>
        )}
      </Route>

      {/* Route scegli candidato */}
      <Route path="/scegli-candidato">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/scegli-candidato" component={pageComponents.ScegliCandidato} />
          </PageTransition>
        )}
      </Route>

      {/* Route statistiche utenti */}
      <Route path="/statistiche-utenti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/statistiche-utenti" component={pageComponents.StatisticheUtenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route strumenti/comunica */}
      <Route path="/strumenti">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/strumenti" component={pageComponents.Strumenti} />
          </PageTransition>
        )}
      </Route>

      {/* Route podio trasparenza */}
      <Route path="/podio-trasparenza">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/podio-trasparenza" component={pageComponents.PodioTrasparenza} />
          </PageTransition>
        )}
      </Route>

      {/* Route notifiche */}
      <Route path="/notifiche">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/notifiche" component={pageComponents.Notifiche} />
          </PageTransition>
        )}
      </Route>

      {/* Route capo di stato */}
      <Route path="/capo-di-stato">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/capo-di-stato" component={pageComponents.CapodiStato} />
          </PageTransition>
        )}
      </Route>

      {/* Route governo */}
      <Route path="/governo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/governo" component={pageComponents.Governo} />
          </PageTransition>
        )}
      </Route>

      {/* Route grazia */}
      <Route path="/grazia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/grazia" component={pageComponents.Grazia} />
          </PageTransition>
        )}
      </Route>

      {/* Route amnistia */}
      <Route path="/amnistia">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/amnistia" component={pageComponents.Amnistia} />
          </PageTransition>
        )}
      </Route>

      {/* Route vota */}
      <Route path="/vota">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/vota" component={pageComponents.Vota} />
          </PageTransition>
        )}
      </Route>

      {/* Route eventi */}
      <Route path="/eventi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/eventi" component={pageComponents.Eventi} />
          </PageTransition>
        )}
      </Route>

      {/* Route proponi */}
      <Route path="/proponi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/proponi" component={pageComponents.Proponi} />
          </PageTransition>
        )}
      </Route>

      {/* Route iniziative popolari */}
      <Route path="/iniziative-popolari">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/iniziative-popolari" component={pageComponents.IniziativePopolare} />
          </PageTransition>
        )}
      </Route>

      {/* Route referendum abrogativi */}
      <Route path="/referendum-abrogativi">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/referendum-abrogativi" component={pageComponents.ReferendumAbrogativi} />
          </PageTransition>
        )}
      </Route>

      {/* Route sostenitori */}
      <Route path="/sostenitori">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/sostenitori" component={pageComponents.Sostenitori} />
          </PageTransition>
        )}
      </Route>

      {/* Route impostazioni */}
      <Route path="/impostazioni">
        {() => (
          <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <div className="container mx-auto px-4 py-8">
              <h1 className="text-3xl font-bold text-gray-900">TEST IMPOSTAZIONI</h1>
              <p className="text-gray-600">Se vedi questo, il routing funziona!</p>
              <ProtectedRoute path="/impostazioni" component={pageComponents.Impostazioni} />
            </div>
          </div>
        )}
      </Route>

      {/* Route reclama profilo */}
      <Route path="/reclama-profilo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/reclama-profilo" component={pageComponents.ReclamaProfilo} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
