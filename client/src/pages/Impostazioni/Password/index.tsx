import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { usePasswordChange } from "../hooks/usePasswordChange";

export default function CambiaPassword() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const {
    formData,
    state,
    updateFormField,
    handleChangePassword,
  } = usePasswordChange({
    onSuccess: () => setLocation("/impostazioni"),
  });

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
            <CardDescription>Devi effettuare il login per cambiare la password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/auth")}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <Button
          variant="ghost"
          onClick={() => setLocation("/impostazioni")}
          className="mb-4"
        >
          ← Torna alle Impostazioni
        </Button>

        <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-purple-50/30 to-pink-50/50">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full -translate-y-16 translate-x-16" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shrink-0">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Cambia Password
              </span>
            </CardTitle>
            <CardDescription className="text-gray-600 text-base">
              Aggiorna le credenziali del tuo account
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password attuale</label>
                <input
                  type="password"
                  placeholder="Inserisci la password attuale"
                  value={formData.currentPassword}
                  onChange={(e) => updateFormField("currentPassword", e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nuova password</label>
                <input
                  type="password"
                  placeholder="Inserisci la nuova password"
                  value={formData.newPassword}
                  onChange={(e) => updateFormField("newPassword", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Conferma nuova password</label>
                <input
                  type="password"
                  placeholder="Conferma la nuova password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormField("confirmPassword", e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={state.isChangingPassword}
                >
                  {state.isChangingPassword ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Aggiornamento...
                    </>
                  ) : (
                    "Aggiorna Password"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/impostazioni")}
                  className="h-12 px-6 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-300"
                >
                  Annulla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
