import { Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";
import { pageComponents } from "../imports";

export const AuthRoutes = () => {
  const [location] = useLocation();
  return (
    <>
      {/* Route reset password */}
      <Route path="/reset-password">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.ResetPasswordPage />
          </PageTransition>
        )}
      </Route>

      <Route path="/reset-password-confirm">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.ResetPasswordConfirmPage />
          </PageTransition>
        )}
      </Route>

      {/* Route verify email */}
      <Route path="/verify-email">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.VerifyEmail />
          </PageTransition>
        )}
      </Route>

      {/* Route informazioni */}
      <Route path="/informazioni">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.Informazioni />
          </PageTransition>
        )}
      </Route>

      {/* Route privacy policy */}
      <Route path="/privacy-policy">
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.PrivacyPolicy />
          </PageTransition>
        )}
      </Route>

      {/* Route 404 - deve essere l'ultima */}
      <Route>
        {() => (
          <PageTransition location={location} type="fade-up">
            <pageComponents.NotFound />
          </PageTransition>
        )}
      </Route>
    </>
  );
};
