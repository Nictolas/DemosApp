import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Download, Trash2, Settings, FileText, Database, Vote, FileJson, FileSpreadsheet } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { usePoliticalOpinionsConsent } from "@/hooks/usePoliticalOpinionsConsent";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { clearAllEncryptedProfiles } from "@/pages/Profilo/utils/encryptedProfileVault";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [isDownloading, setIsDownloading] = useState(false);
  
  const revokeConsentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', '/api/user/political-opinions-consent/revoke');
      return response.data;
    },
    onSuccess: async () => {
      // First stop network requests, then purge their in-memory and encrypted
      // snapshots. A revoked answer must not be resurrected by a late GET.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['opinioniQuestions'] }),
        queryClient.cancelQueries({ queryKey: ['statsOpinionQuestions'] }),
        queryClient.cancelQueries({ queryKey: ['profilePolitical'] }),
        queryClient.cancelQueries({ queryKey: ['profileFull'] }),
      ]);
      queryClient.removeQueries({ queryKey: ['opinioniQuestions'] });
      queryClient.removeQueries({ queryKey: ['statsOpinionQuestions'] });
      queryClient.removeQueries({ queryKey: ['profilePolitical'] });
      queryClient.removeQueries({ queryKey: ['profileFull'] });
      await clearAllEncryptedProfiles();
      queryClient.invalidateQueries({ queryKey: ['political-opinions-consent'] });
      queryClient.invalidateQueries({ queryKey: ['profileConsent'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({
        title: "Consenso revocato",
        description: "Il consenso alle opinioni politiche è stato revocato. Le tue opinioni sono state eliminate.",
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

  const handleDownloadData = async (format: 'json' | 'csv' = 'json') => {
    try {
      setIsDownloading(true);
      
      if (format === 'csv') {
        // Per CSV, l'API restituisce direttamente il file CSV
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/user/data-export?format=csv`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          throw new Error('Errore nel recupero dei dati');
        }
        
        const csv = await response.text();
        const timestamp = new Date().toISOString().split('T')[0];
        const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(csvBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dati-personali-${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download completato",
          description: "I tuoi dati sono stati scaricati in formato CSV.",
        });
      } else {
        // Per JSON, l'API restituisce JSON
        const response = await apiRequest('GET', `/api/user/data-export?format=json`);
        
        if (!response.success || !response.data) {
          throw new Error('Errore nel recupero dei dati');
        }

        const data = response.data;
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dati-personali-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download completato",
          description: "I tuoi dati sono stati scaricati in formato JSON.",
        });
      }
    } catch (error: any) {
      console.error('Errore nel download dati:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il download dei dati. Riprova più tardi.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Funzione per convertire JSON in CSV
  const convertToCSV = (data: any): string => {
    const lines: string[] = [];
    
    // Header principale
    lines.push('Sezione,Campo,Valore');
    
    // Profilo utente
    if (data.user_profile) {
      Object.entries(data.user_profile).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          lines.push(`Profilo Utente,${key},"${String(value).replace(/"/g, '""')}"`);
        }
      });
    }
    
    // Opinioni
    if (data.opinions && Array.isArray(data.opinions)) {
      data.opinions.forEach((opinion: any, index: number) => {
        Object.entries(opinion).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            lines.push(`Opinioni [${index + 1}],${key},"${String(value).replace(/"/g, '""')}"`);
          }
        });
      });
    }
    
    // Voti
    if (data.votes && Array.isArray(data.votes)) {
      data.votes.forEach((vote: any, index: number) => {
        Object.entries(vote).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            lines.push(`Voti [${index + 1}],${key},"${String(value).replace(/"/g, '""')}"`);
          }
        });
      });
    }
    
    // Comunicazioni
    if (data.communications && Array.isArray(data.communications)) {
      data.communications.forEach((comm: any, index: number) => {
        Object.entries(comm).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            lines.push(`Comunicazioni [${index + 1}],${key},"${String(value).replace(/"/g, '""')}"`);
          }
        });
      });
    }
    
    // Notifiche
    if (data.notifications && Array.isArray(data.notifications)) {
      data.notifications.forEach((notif: any, index: number) => {
        Object.entries(notif).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            lines.push(`Notifiche [${index + 1}],${key},"${String(value).replace(/"/g, '""')}"`);
          }
        });
      });
    }
    
    // Consensi
    if (data.consent_history) {
      Object.entries(data.consent_history).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          lines.push(`Consensi,${key},"${String(value).replace(/"/g, '""')}"`);
        }
      });
    }
    
    return lines.join('\n');
  };

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
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Diritto di Portabilità (GDPR Art. 20):</strong> Scarica tutti i tuoi dati personali 
                in formato strutturato e portabile.
              </p>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline"
                    className="w-full justify-start"
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Download in corso...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Scarica i Tuoi Dati
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem 
                    onClick={() => handleDownloadData('json')}
                    disabled={isDownloading}
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    Download JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDownloadData('csv')}
                    disabled={isDownloading}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Download CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <p className="text-xs text-gray-500 mt-2">
                I dati includono: profilo, opinioni, voti, comunicazioni, notifiche e consensi. 
                Il formato CSV è più portabile e può essere importato in altri servizi.
              </p>
            </div>
            
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
                ⚠️ Attenzione: Le tue opinioni politiche già espresse verranno eliminate 
                completamente dal sistema (conforme GDPR Art. 17 - Diritto alla cancellazione).
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
