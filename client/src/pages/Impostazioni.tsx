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
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

export default function Impostazioni() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [reauthDialogOpen, setReauthDialogOpen] = React.useState(false);
  const [reauthPassword, setReauthPassword] = React.useState("");
  const [reauthError, setReauthError] = React.useState("");

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
      window.location.href = "/";
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

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    const auth = getAuth();
    if (!auth.currentUser) {
      toast({
        title: "Errore",
        description: "Utente non autenticato. Riprova.",
        variant: "destructive",
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
      return;
    }
    try {
      await auth.currentUser.delete();
      toast({
        title: "Account eliminato",
        description: "Il tuo profilo è stato eliminato con successo.",
        variant: "default",
      });
      window.location.href = "/";
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login") {
        setReauthDialogOpen(true);
      } else {
        toast({
          title: "Errore",
          description: error.message || "Si è verificato un errore durante l'eliminazione dell'account.",
          variant: "destructive",
        });
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleReauthenticateAndDelete = async () => {
    setIsDeleting(true);
    setReauthError("");
    const auth = getAuth();
    if (!auth.currentUser) {
      setReauthError("Utente non autenticato. Riprova.");
      setIsDeleting(false);
      return;
    }
    try {
      if (!auth.currentUser.email) throw new Error("Email utente non disponibile.");
      const credential = EmailAuthProvider.credential(auth.currentUser.email, reauthPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await auth.currentUser.delete();
      toast({
        title: "Account eliminato",
        description: "Il tuo profilo è stato eliminato con successo.",
        variant: "default",
      });
      window.location.href = "/";
    } catch (error: any) {
      setReauthError(error.message || "Errore durante la reautenticazione.");
    } finally {
      setIsDeleting(false);
      setReauthDialogOpen(false);
      setReauthPassword("");
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
                <Link href="/menu/profilo">
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
                <Link href="/privacy-policy">
                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
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
                </Link>
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
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-red-700 h-full flex">
                      <CardContent className="p-4 flex items-center gap-3 h-full">
                        <span className="inline-flex items-center justify-center rounded-full bg-red-100 p-2 mr-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </span>
                        <div>
                          <h4 className="font-medium text-red-700">Elimina il mio profilo</h4>
                          <p className="text-sm text-muted-foreground">Cancella definitivamente il tuo account DEMOS</p>
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sei sicuro di voler eliminare il tuo profilo?</DialogTitle>
                      <DialogDescription>
                        Questa azione è <span className="text-red-700 font-semibold">irreversibile</span>. Tutti i tuoi dati saranno cancellati e non potrai più accedere alla piattaforma con questo account.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Annulla</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                        {isDeleting ? "Eliminazione..." : "Elimina definitivamente"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={reauthDialogOpen} onOpenChange={setReauthDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Per motivi di sicurezza, reinserisci la tua password</DialogTitle>
                      <DialogDescription>
                        Per eliminare definitivamente il tuo account, devi autenticarti nuovamente.
                      </DialogDescription>
                    </DialogHeader>
                    <input
                      type="password"
                      className="w-full border rounded px-3 py-2 mt-2"
                      placeholder="Password"
                      value={reauthPassword}
                      onChange={e => setReauthPassword(e.target.value)}
                      disabled={isDeleting}
                    />
                    {reauthError && <div className="text-red-600 text-sm mt-2">{reauthError}</div>}
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Annulla</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={handleReauthenticateAndDelete} disabled={isDeleting || !reauthPassword}>
                        {isDeleting ? "Eliminazione..." : "Elimina definitivamente"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
      if (!auth.currentUser) throw new Error("Utente non autenticato.");
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