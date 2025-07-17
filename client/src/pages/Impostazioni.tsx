import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Shield, User, Bell, Lock, FileText, LogOut } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

export default function Impostazioni() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { toast } = useToast();

  // Redirect to landing page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/" />;
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
              Gestisci il tuo account, la sicurezza e le preferenze della piattaforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Account e Sicurezza */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Account e Sicurezza
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Card className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md transition-shadow">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Lock className="h-5 w-5 text-red-500" />
                            <div>
                              <h4 className="font-medium">Cambia Password</h4>
                              <p className="text-sm text-muted-foreground">Cambia la tua password inserendo quella attuale e la nuova</p>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Cambia Password</DialogTitle>
                        <DialogDescription>Inserisci la password attuale e la nuova password due volte.</DialogDescription>
                      </DialogHeader>
                      <ChangePasswordForm user={user} toast={toast} />
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Annulla</Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Card>
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

            {/* Notifiche */}
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

            {/* Informazioni e Privacy */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Informazioni e Privacy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Link href="/informazioni">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500 h-full flex">
                    <CardContent className="p-4 flex items-center gap-3 h-full">
                      <span className="inline-flex items-center justify-center rounded-full bg-blue-100 p-2 mr-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                      </span>
                      <div>
                        <h4 className="font-medium">Informazioni</h4>
                        <p className="text-sm text-muted-foreground">Scopri di più sull'app DEMOS</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>

            {/* Azioni */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <LogOut className="h-5 w-5" />
                Azioni
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/dona">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-yellow-500 h-full flex">
                    <CardContent className="p-4 flex items-center gap-3 h-full">
                      <span className="inline-flex items-center justify-center rounded-full bg-yellow-100 p-2 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0 0V4m0 7v9m-7-7h14" /></svg>
                      </span>
                      <div>
                        <h4 className="font-medium">Dona</h4>
                        <p className="text-sm text-muted-foreground">Sostieni il progetto DEMOS</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-500 h-full flex" onClick={handleLogout}>
                  <CardContent className="p-4 flex items-center gap-3 h-full">
                    <LogOut className="h-5 w-5 text-red-500 mr-2" />
                    <div>
                      <h4 className="font-medium">Disconnetti</h4>
                      <p className="text-sm text-muted-foreground">Esci dal tuo account</p>
                    </div>
                    {isLoggingOut && <Loader2 className="ml-2 h-4 w-4 animate-spin text-red-500" />}
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChangePasswordForm({ user, toast }: { user: any, toast: any }) {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le nuove password non coincidono.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast({
        title: "Password cambiata",
        description: "La tua password è stata aggiornata con successo.",
        variant: "default",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Errore durante il cambio password.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword} className="space-y-4">
      <Input
        type="password"
        placeholder="Password attuale"
        value={currentPassword}
        onChange={e => setCurrentPassword(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Nuova password"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Conferma nuova password"
        value={confirmPassword}
        onChange={e => setConfirmPassword(e.target.value)}
        required
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvataggio..." : "Cambia Password"}
      </Button>
    </form>
  );
}