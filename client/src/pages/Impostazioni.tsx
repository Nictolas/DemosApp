import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Shield, User, Bell, Lock, FileText, LogOut } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";

export default function Impostazioni() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { toast } = useToast();

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
      toast({
        title: "Logout effettuato",
        description: "Sei stato disconnesso con successo.",
        variant: "default",
      });
    } catch (error) {
      console.error("Errore durante il logout:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il logout.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navbar />
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
              <Settings className="h-8 w-8 text-primary" />
              Impostazioni
            </CardTitle>
            <CardDescription>
              Gestisci le impostazioni del tuo account e della piattaforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Account
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/profilo">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">Modifica Profilo</h4>
                          <p className="text-sm text-muted-foreground">Aggiorna i tuoi dati personali</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/reclama-profilo">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-green-500" />
                        <div>
                          <h4 className="font-medium">Reclama Profilo</h4>
                          <p className="text-sm text-muted-foreground">Verifica la tua identità politica</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Privacy & Security Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Privacy e Sicurezza
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-red-500" />
                      <div>
                        <h4 className="font-medium">Cambia Password</h4>
                        <p className="text-sm text-muted-foreground">Aggiorna la tua password</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-purple-500" />
                      <div>
                        <h4 className="font-medium">Privacy Policy</h4>
                        <p className="text-sm text-muted-foreground">Leggi la nostra privacy policy</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Notifications Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifiche
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/notifiche">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Bell className="h-5 w-5 text-orange-500" />
                        <div>
                          <h4 className="font-medium">Gestisci Notifiche</h4>
                          <p className="text-sm text-muted-foreground">Visualizza e gestisci le tue notifiche</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </CardContent>
          <div className="flex justify-end p-4 gap-2">
            <Link href="/dona">
              <Button variant="outline" className="max-w-sm">
                Dona
              </Button>
            </Link>
            <Button 
              variant="destructive" 
              className="max-w-sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnessione in corso...
                </>
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnetti
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}