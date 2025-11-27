import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Download, Trash2, Settings, FileText, Database, Vote } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { usePoliticalOpinionsConsent } from "@/hooks/usePoliticalOpinionsConsent";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

export default function GDPR() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { hasConsent, isLoading: isLoadingConsent, consent } = usePoliticalOpinionsConsent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  
  const revokeConsentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', '/api/user/political-opinions-consent/revoke');
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['political-opinions-consent'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({
        title: "Consenso revocato",
        description: "Il consenso alle opinioni politiche è stato revocato. Le tue opinioni sono state anonimizzate.",
      });
      setShowRevokeDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella revoca del consenso. Riprova più tardi.",
        variant: "destructive",
      });
    }
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
            <CardDescription>Devi effettuare il login per accedere ai diritti GDPR.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation('/auth')}>
              Vai al Login
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/impostazioni')}
            className="mb-4"
          >
            ← Torna alle Impostazioni
          </Button>
          
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-600 to-blue-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">
                Diritti GDPR
              </CardTitle>
              <CardDescription className="text-green-100 text-lg">
                Gestisci i tuoi diritti sulla protezione dei dati personali
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Informazioni Generali */}
        <Alert className="mb-6 bg-white">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Regolamento Generale sulla Protezione dei Dati (GDPR):</strong> Hai il diritto 
            di controllare come vengono utilizzati i tuoi dati personali. Utilizza le funzionalità 
            qui sotto per esercitare i tuoi diritti.
          </AlertDescription>
        </Alert>

        {/* Sezione Gestione Dati */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Gestione Dati
            </CardTitle>
            <CardDescription>
              Controlla e gestisci i tuoi dati personali
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/impostazioni/scarica-dati')}
              variant="outline"
              className="w-full justify-start"
            >
              <Download className="h-4 w-4 mr-2" />
              Scarica i Tuoi Dati
            </Button>
            
            <Button 
              onClick={() => setLocation('/impostazioni/gestione-privacy')}
              variant="outline"
              className="w-full justify-start"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gestione Privacy
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Consenso Opinioni Politiche (GDPR Art. 9) */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Consenso Opinioni Politiche (GDPR Art. 9)
            </CardTitle>
            <CardDescription>
              Gestisci il consenso al trattamento delle opinioni politiche
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingConsent ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Stato Consenso</div>
                      <div className="text-sm text-gray-600">
                        {hasConsent ? (
                          <span className="text-green-600 font-semibold">✓ Consenso concesso</span>
                        ) : (
                          <span className="text-gray-500">Consenso non concesso</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {hasConsent && consent?.timestamp && (
                    <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                      Consenso concesso il: {new Date(consent.timestamp).toLocaleString('it-IT')}
                    </div>
                  )}
                </div>
                
                {hasConsent ? (
                  <Button 
                    onClick={() => setShowRevokeDialog(true)}
                    variant="outline"
                    className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    <Vote className="h-4 w-4 mr-2" />
                    Revoca Consenso
                  </Button>
                ) : (
                  <Alert className="bg-blue-50 border-blue-200">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Non hai ancora concesso il consenso alle opinioni politiche. 
                      Puoi concederlo quando accedi alle pagine delle opinioni.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sezione Diritti Specifici GDPR */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Diritti Specifici GDPR
            </CardTitle>
            <CardDescription>
              Esercita i tuoi diritti specifici secondo il GDPR
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/impostazioni/limitazione-trattamento')}
              variant="outline"
              className="w-full justify-start"
            >
              <Shield className="h-4 w-4 mr-2" />
              Limitazione Trattamento (Art. 18)
            </Button>
            
            <Button 
              onClick={() => setLocation('/impostazioni/opposizione-trattamento')}
              variant="outline"
              className="w-full justify-start"
            >
              <FileText className="h-4 w-4 mr-2" />
              Opposizione Trattamento (Art. 21)
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Account */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>
              Gestisci il tuo account e i dati associati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/impostazioni/cancella-account')}
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancella Account
            </Button>
          </CardContent>
        </Card>

        {/* Sezione Documenti */}
        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documenti Legali
            </CardTitle>
            <CardDescription>
              Consulta i documenti relativi alla protezione dei dati
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setLocation('/privacy-policy')}
              variant="outline"
              className="w-full justify-start"
            >
              <FileText className="h-4 w-4 mr-2" />
              Privacy Policy
            </Button>
            
            <Button 
              onClick={() => setLocation('/data-retention')}
              variant="outline"
              className="w-full justify-start"
            >
              <Database className="h-4 w-4 mr-2" />
              Data Retention
            </Button>
          </CardContent>
        </Card>

      </div>
      
      {/* Dialog conferma revoca consenso */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoca Consenso Opinioni Politiche</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Sei sicuro di voler revocare il consenso al trattamento delle opinioni politiche?
              </p>
              <p className="font-semibold text-orange-600">
                ⚠️ Attenzione: Le tue opinioni politiche già espresse verranno anonimizzate 
                (mantenute per statistiche aggregate ma non più associate al tuo account).
              </p>
              <p>
                Dopo la revoca, non potrai più esprimere opinioni politiche sulla piattaforma, 
                ma potrai continuare a utilizzare tutte le altre funzionalità.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeConsentMutation.isPending}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeConsentMutation.mutate()}
              disabled={revokeConsentMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {revokeConsentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revocazione...
                </>
              ) : (
                'Conferma Revoca'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
