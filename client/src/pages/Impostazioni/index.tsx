import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { usePasswordChange } from "./hooks/usePasswordChange";
import { useLogout } from "./hooks/useLogout";
import { LinksSection } from "./components/LinksSection";
import { LogoutDialog } from "./components/LogoutDialog";
import { PageContainer } from "@/components/PageContainer";

export default function Impostazioni() {
  const { user, isLoading } = useAuth();
  const passwordChange = usePasswordChange();
  const logout = useLogout();

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
      <div className="impostazioni-page__inner flex flex-1 flex-col min-h-0 px-3 py-2 sm:px-4 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto my-auto py-2">
          <LinksSection
            formData={passwordChange.formData}
            isChangingPassword={passwordChange.state.isChangingPassword}
            showChangePassword={passwordChange.state.showChangePassword}
            onUpdateField={passwordChange.updateFormField}
            onShowForm={passwordChange.showForm}
            onHideForm={passwordChange.hideForm}
            onSubmit={passwordChange.handleChangePassword}
            onLogout={logout.showLogoutDialog}
          />
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
