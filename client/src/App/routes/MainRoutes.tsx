import { Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/lib/protected-route";
import { pageComponents } from "../imports";

export const MainRoutes = () => {
  const [location] = useLocation();
  return (
    <>
      {/* Route principale */}
      <Route path="/">
        {() => (
          <PageTransition location={location} type="fade-up" delay={100}>
            <pageComponents.LandingPage />
          </PageTransition>
        )}
      </Route>

      {/* Route di autenticazione */}
      <Route path="/auth">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.AuthPage />
          </PageTransition>
        )}
      </Route>

      <Route path="/debug-auth">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.DebugAuth />
          </PageTransition>
        )}
      </Route>

      <Route path="/database-test">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.DatabaseTest />
          </PageTransition>
        )}
      </Route>

      {/* Route di registrazione candidatura ed elezione */}
      <Route path="/registrazione-candidatura">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneCandidatura />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-elezione">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneElezione />
          </PageTransition>
        )}
      </Route>

      {/* Route di registrazione step-by-step */}
      <Route path="/registrazione-nome">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneNome />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-genere">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneGenere />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-cittadinanza">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneCittadinanza />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-data-nascita">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneDataNascita />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-codice-fiscale">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneCodiceFiscale />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-2-dati">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneDati />
          </PageTransition>
        )}
      </Route>

      <Route path="/registrazione-3-residenza">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.RegistrazioneResidenza />
          </PageTransition>
        )}
      </Route>

      {/* Route del menu principale */}
      <Route path="/menu">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/menu" component={pageComponents.Menu} />
          </PageTransition>
        )}
      </Route>

      {/* Route del profilo */}
      <Route path="/menu/profilo">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/menu/profilo" component={pageComponents.Profilo} />
          </PageTransition>
        )}
      </Route>

      <Route path="/menu/profilo/:userId">
        {(params) => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/menu/profilo/:userId" component={pageComponents.Profilo} />
          </PageTransition>
        )}
      </Route>

      <Route path="/modifica-immagine">
        {() => (
          <PageTransition location={location} type="fade-up" showLoader={true} loaderDuration={300}>
            <ProtectedRoute path="/modifica-immagine" component={pageComponents.ModificaImmagine} />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
