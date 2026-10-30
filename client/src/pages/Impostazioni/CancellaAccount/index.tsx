import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, AlertTriangle, Shield, Database } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { clearSessionTokens } from "@/lib/auth-token";
import { clearAllProfileSummaries } from "@/pages/Profilo/utils/profileSummaryCache";
import { clearAllEncryptedProfiles } from "@/pages/Profilo/utils/encryptedProfileVault";

interface DeletionStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export default function CancellaAccount() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [understandConsequences, setUnderstandConsequences] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadRequirements = async () => {
      try {
        const response = await apiRequest("GET", "/api/user/delete-account/requirements");
        if (!cancelled) {
          setRequiresPassword(response.data?.requiresPassword === true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossibile verificare i requisiti di cancellazione");
        }
      }
    };

    void loadRequirements();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const steps: DeletionStep[] = useMemo(() => [
    {
      id: "backup",
      title: "Backup dei Dati",
      description: "Puoi scaricare una copia dei tuoi dati prima della cancellazione",
      icon: <Database className="h-5 w-5" />,
      completed: true,
    },
    {
      id: "confirm",
      title: "Conferma Identità",
      description: requiresPassword === false
        ? "Il tuo account non usa una password: non è necessario inserirla"
        : "Inserisci la tua password per confermare l'identità",
      icon: <Shield className="h-5 w-5" />,
      completed: requiresPassword === false || (requiresPassword === true && password.length > 0),
    },
    {
      id: "understand",
      title: "Comprensione Conseguenze",
      description: "Conferma di aver compreso le conseguenze della cancellazione",
      icon: <AlertTriangle className="h-5 w-5" />,
      completed: understandConsequences && confirmText === "CANCELLA",
    },
  ], [confirmText, password, requiresPassword, understandConsequences]);

  const requirementsReady = requiresPassword !== null;
  const allStepsCompleted = requirementsReady && steps.every((step) => step.completed);

  const handleDeleteAccount = async () => {
    if (!user || !allStepsCompleted) return;

    setIsDeleting(true);
    setError(null);

    try {
      await apiRequest("DELETE", "/api/user/delete-account", {
        ...(requiresPassword ? { password } : {}),
        confirmText,
      });

      // The server already deleted the account. First revoke local access,
      // then cancel any outstanding authenticated GET, erase RAM and wait for
      // every already-started encrypted IndexedDB write to settle and be wiped.
      // Reloading before this barrier can resurrect deleted political data.
      clearSessionTokens();
      await queryClient.cancelQueries();
      queryClient.clear();
      clearAllProfileSummaries();
      await clearAllEncryptedProfiles();
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la cancellazione");
      setIsDeleting(false);
    }
  };

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
            <CardDescription>Devi effettuare il login per accedere a questa pagina.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/auth")}>Vai al Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/impostazioni")} className="mb-4">
            ← Torna alle Impostazioni
          </Button>

          <Card className="border-0 shadow-lg bg-gradient-to-r from-red-600 to-orange-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">Cancella Account</CardTitle>
              <CardDescription className="text-red-100 text-lg">
                Questa azione è irreversibile e avvia la cancellazione dei dati associati all'account secondo la Privacy Policy.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attenzione:</strong> la cancellazione dell'account è permanente. I dati collegati all'account vengono eliminati secondo il percorso di cancellazione DEMOS; eventuali dati soggetti a obblighi di conservazione sono trattati come indicato nella Privacy Policy.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!requirementsReady && !error && (
          <Alert className="mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Verifica dei requisiti di cancellazione in corso…</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6 mb-8">
          <h2 className="text-2xl font-bold">Passaggi per la Cancellazione</h2>

          {steps.map((step, index) => (
            <Card key={step.id} className={step.completed ? "border-green-200 bg-green-50" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.completed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                    {step.completed ? "✓" : index + 1}
                  </div>
                  {step.icon}
                  {step.title}
                </CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {step.id === "backup" && (
                  <Button variant="outline" onClick={() => setLocation("/impostazioni/scarica-dati")} className="w-full">
                    <Database className="h-4 w-4 mr-2" />
                    Scarica i Tuoi Dati
                  </Button>
                )}

                {step.id === "confirm" && requiresPassword === true && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Inserisci la tua password"
                      autoComplete="current-password"
                    />
                  </div>
                )}

                {step.id === "confirm" && requiresPassword === false && (
                  <p className="text-sm text-muted-foreground">
                    Account autenticato tramite OAuth/passkey: la sessione autenticata e la conferma finale sono sufficienti.
                  </p>
                )}

                {step.id === "understand" && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="understand"
                        checked={understandConsequences}
                        onCheckedChange={(checked) => setUnderstandConsequences(checked as boolean)}
                      />
                      <Label htmlFor="understand">Ho compreso che la cancellazione è irreversibile</Label>
                    </div>
                    <div>
                      <Label htmlFor="confirmText">Digita "CANCELLA" per confermare</Label>
                      <Input
                        id="confirmText"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="CANCELLA"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Conseguenze della Cancellazione
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>• <strong>Profilo:</strong> l'account e i dati del profilo vengono rimossi dal sistema operativo DEMOS.</p>
            <p>• <strong>Opinioni e attività:</strong> i dati direttamente associati all'account vengono eliminati secondo il percorso privacy canonico.</p>
            <p>• <strong>Accesso:</strong> le credenziali locali vengono rimosse e non potrai più accedere all'account cancellato.</p>
            <p>• <strong>Retention:</strong> eventuali eccezioni strettamente necessarie sono descritte nella Privacy Policy.</p>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => setShowDeleteDialog(true)}
            disabled={!allStepsCompleted || isDeleting}
            className="px-8 py-3"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Cancella Definitivamente l'Account
          </Button>
        </div>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Conferma Cancellazione
              </DialogTitle>
              <DialogDescription>
                Sei sicuro di voler cancellare definitivamente il tuo account? Questa azione non può essere annullata.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                Annulla
              </Button>
              <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting || !allStepsCompleted}>
                {isDeleting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancellazione...</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" />Cancella Account</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
