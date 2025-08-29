import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm, RegisterForm, LoginFormValues, RegisterFormValues } from "@/components/auth";
import './auth-page.css';

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, isLoading, loginMutation, registerMutation, resendVerificationEmail } = useAuth();
  const { toast } = useToast();

  // Submit handlers
  const onLoginSubmit = (data: LoginFormValues) => {
    // Normalizza l'email a lowercase
    loginMutation.mutate({ ...data, email: data.email.trim().toLowerCase() });
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    // Normalizza l'email a lowercase e invia tutti i campi per il backend
    const registerData = {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      codice_fiscale: data.codice_fiscale.toUpperCase(),
      nome: data.nome,
      cognome: data.cognome,
      ruolo: data.ruolo,
      data_nascita: data.data_nascita,
      genere: data.genere,
      cittadinanza: data.cittadinanza,
      paese_residenza: data.paese_residenza,
      regione_residenza: data.regione_residenza,
      provincia_residenza: data.provincia_residenza,
      comune_residenza: data.comune_residenza,
      paese_elezione: data.paese_elezione,
      regione_elezione: data.regione_elezione,
      provincia_elezione: data.provincia_elezione,
      comune_elezione: data.comune_elezione,
      paese_candidatura: data.paese_candidatura,
      regione_candidatura: data.regione_candidatura,
      provincia_candidatura: data.provincia_candidatura,
      comune_candidatura: data.comune_candidatura,
      grado_elezione: data.grado_elezione,
      grado_candidatura: data.grado_candidatura,
    };
    registerMutation.mutate(registerData);
  };

  const handleResendVerification = async (email: string) => {
    try {
      await resendVerificationEmail(email);
      toast({ 
        title: "Email inviata!", 
        description: "Nuovo link di verifica inviato alla tua email",
        variant: "default"
      });
    } catch (error) {
      toast({ 
        title: "Errore", 
        description: "Impossibile inviare l'email di verifica. Riprova più tardi.",
        variant: "destructive"
      });
    }
  };

  // Redirect se l'utente è già autenticato
  if (user && !isLoading) {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/20">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Accesso a DEMOS</CardTitle>
          <CardDescription className="text-center">Accedi o registrati per continuare</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Accedi</TabsTrigger>
              <TabsTrigger value="register">Registrati</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <LoginForm
                onSubmit={onLoginSubmit}
                isLoading={loginMutation.isPending}
                error={
                  loginMutation.error && (loginMutation.error as any).requiresVerification
                    ? "Devi confermare la tua email prima di accedere."
                    : loginMutation.error?.message
                }
              />
            </TabsContent>
            
            <TabsContent value="register">
              <RegisterForm
                onSubmit={onRegisterSubmit}
                isLoading={registerMutation.isPending}
                error={registerMutation.error?.message}
                requiresVerification={registerMutation.data && (registerMutation.data as any).requiresVerification}
                onResendVerification={handleResendVerification}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-gray-500">
          {activeTab === "login" ? (
            <p>
              Non hai un account?{" "}
              <Button variant="link" className="p-0" onClick={() => setActiveTab("register")}>
                Registrati
              </Button>
            </p>
          ) : (
            <p>
              Hai già un account?{" "}
              <Button variant="link" className="p-0" onClick={() => setActiveTab("login")}>
                Accedi
              </Button>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
