import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { PageTransition } from "@/components/PageTransition";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      {(params) => (
        <PageTransition location={location}>
          <Component {...params} />
        </PageTransition>
      )}
    </Route>
  );
}