import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Settings, Shield, User, Bell, Lock, FileText, LogOut, Home, MessageSquare, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { getApiUrl } from "@/lib/api-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Impostazioni() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { toast } = useToast();

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
            <Link href="/auth">
              <Button className="w-full">Vai al Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutMutation.mutateAsync();
      // Reindirizza alla home page dopo il logout
      setLocation("/");
    } catch (error) {
      console.error('Errore logout:', error);
      toast({
        title: "Errore",
        description: "Errore durante il logout. Riprova.",
        variant: "destructive",
      });
      setIsLoggingOut(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non coincidono.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const token = localStorage.getItem('authToken');
              const response = await fetch(getApiUrl('/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          currentPassword,
          newPassword 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Successo",
          description: "Password aggiornata con successo!",
          variant: "default",
        });
        setShowChangePassword(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({
          title: "Errore",
          description: data.error || "Errore durante il cambio password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Errore di connessione. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const showMigrationMessage = (feature: string) => {
    toast({
      title: "Funzione temporaneamente disabilitata",
      description: `${feature} sarà disponibile dopo il completamento della migrazione da Firebase.`,
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/preferiti">
            <Button variant="ghost" size="icon">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
            <p className="text-gray-600">Gestisci il tuo account e le preferenze</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Azioni Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sicurezza Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/menu/profilo">
                <Button className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  Modifica Profilo
                </Button>
              </Link>

              {!showChangePassword ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowChangePassword(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Cambia Password
                </Button>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Password attuale</label>
                    <Input
                      type="password"
                      placeholder="Inserisci la password attuale"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Nuova password</label>
                    <Input
                      type="password"
                      placeholder="Inserisci la nuova password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Conferma nuova password</label>
                    <Input
                      type="password"
                      placeholder="Conferma la nuova password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Aggiornamento...
                        </>
                      ) : (
                        "Aggiorna Password"
                      )}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        setShowChangePassword(false);
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </form>
              )}
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => showMigrationMessage("Eliminazione account")}
              >
                <Shield className="h-4 w-4 mr-2" />
                Elimina Account
              </Button>
            </CardContent>
          </Card>

          {/* Collegamenti */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Collegamenti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/privacy-policy">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Privacy Policy
                </Button>
              </Link>
              
              <Link href="/informazioni">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Informazioni
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Esci dall'Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={() => setShowLogoutDialog(true)}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnessione...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog di conferma logout */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent className="bg-white border border-gray-200 shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Vuoi uscire?</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler effettuare il logout? Dovrai effettuare nuovamente l'accesso per utilizzare l'applicazione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
