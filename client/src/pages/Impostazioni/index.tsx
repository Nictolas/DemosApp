import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useLogout } from "./hooks/useLogout";
import { LinksSection } from "./components/LinksSection";
import { IdentityVerificationSection } from "./components/IdentityVerificationSection";
import { LogoutDialog } from "./components/LogoutDialog";
import { PageContainer } from "@/components/PageContainer";
import { toast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Impostazioni() {
  const { user, isLoading } = useAuth();
  const logout = useLogout();

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get('cie');

    if (!['success', 'error', 'already-linked'].includes(outcome || '')) {
      return;
    }

    if (outcome === 'success') {
      queryClient.invalidateQueries({
        queryKey: ["/auth/identity/status"],
        exact: true
      });

      queryClient.refetchQueries({
        queryKey: ["/auth/identity/status"],
        exact: true,
        type: "active"
      });

      toast({
        title: "Identità verificata",
        description: "La verifica CIE è stata completata con successo."
      });
    } else if (outcome === 'already-linked') {
      toast({
        title: "Identità già collegata",
        description: "Questa identità CIE risulta già associata a un altro account DEMOS.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Verifica CIE non completata",
        description: "Non è stato possibile completare la verifica con CIE. Puoi riprovare.",
        variant: "destructive"
      });
    }

    url.searchParams.delete('cie');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  if (isLoading) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer className="bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere alle impostazioni.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = '/auth'}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="impostazioni-page bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="impostazioni-page__inner app-page-scroll flex h-full min-h-0 flex-col overflow-y-auto px-3 py-2 sm:px-4">
        <div className="w-full max-w-2xl mx-auto py-2 sm:px-1 space-y-4">
          <IdentityVerificationSection />
          <LinksSection onLogout={logout.showLogoutDialog} />
        </div>
      </div>

      {/* Dialog di conferma logout */}
      <LogoutDialog
        open={logout.state.showLogoutDialog}
        onOpenChange={logout.state.showLogoutDialog ? logout.hideLogoutDialog : logout.showLogoutDialog}
        onConfirm={logout.handleLogout}
      />
    </PageContainer>
  );
}
