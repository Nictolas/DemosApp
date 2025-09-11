import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { usePasswordChange } from "./hooks/usePasswordChange";
import { useLogout } from "./hooks/useLogout";
import { Header } from "./components/Header";
import { SecuritySection } from "./components/SecuritySection";
import { LinksSection } from "./components/LinksSection";
import { LogoutSection } from "./components/LogoutSection";
import { LogoutDialog } from "./components/LogoutDialog";

export default function Impostazioni() {
  const { user, isLoading } = useAuth();
  const passwordChange = usePasswordChange();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <Header />

        <div className="grid gap-8">
          {/* Sezione Sicurezza */}
          <div className="transform hover:scale-[1.02] transition-all duration-300">
            <SecuritySection
              formData={passwordChange.formData}
              isChangingPassword={passwordChange.state.isChangingPassword}
              showChangePassword={passwordChange.state.showChangePassword}
              onUpdateField={passwordChange.updateFormField}
              onShowForm={passwordChange.showForm}
              onHideForm={passwordChange.hideForm}
              onSubmit={passwordChange.handleChangePassword}
            />
          </div>

          {/* Sezione Collegamenti */}
          <div className="transform hover:scale-[1.02] transition-all duration-300">
            <LinksSection />
          </div>

          {/* Sezione Logout */}
          <div className="transform hover:scale-[1.02] transition-all duration-300">
            <LogoutSection
              isLoggingOut={logout.state.isLoggingOut}
              onLogout={logout.showLogoutDialog}
            />
          </div>
        </div>
      </div>

      {/* Dialog di conferma logout */}
      <LogoutDialog
        open={logout.state.showLogoutDialog}
        onOpenChange={logout.state.showLogoutDialog ? logout.hideLogoutDialog : logout.showLogoutDialog}
        onConfirm={logout.handleLogout}
      />
    </div>
  );
}
