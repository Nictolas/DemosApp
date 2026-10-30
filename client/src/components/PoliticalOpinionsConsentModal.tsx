import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, AlertCircle, ExternalLink } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { getAuthToken } from '@/lib/auth-token';
import { clearAllEncryptedProfiles } from '@/pages/Profilo/utils/encryptedProfileVault';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface PoliticalOpinionsConsentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsentGranted?: () => void;
}

export function PoliticalOpinionsConsentModal({
  open,
  onOpenChange,
  onConsentGranted
}: PoliticalOpinionsConsentModalProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const consentMutation = useMutation({
    mutationFn: async (consent: boolean) => {
      const response = await apiRequest('POST', '/api/user/political-opinions-consent', {
        consent
      });
      if (!response.ok || response.data?.success !== true) {
        throw new Error("Il server non ha confermato la concessione del consenso.");
      }
      return response.data;
    },
    onSuccess: async () => {
      const expectedOwner = user?.id;
      const authToken = getAuthToken();
      if (!expectedOwner || !authToken) {
        throw new Error("Consenso registrato, ma la sessione non è verificabile.");
      }
      // The server has granted a new consent epoch. Stop old personal reads
      // before allowing the new session to open political opinion pages.
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
      // IndexedDB writes may already be in flight: wait for the vault's
      // write barrier and wipe before invoking navigation callbacks.
      await clearAllEncryptedProfiles();
      // Re-verify the existing /auth/me query once after this explicit
      // consent change. Do not issue an extra dedicated consent GET.
      const authKey = ['user', authToken] as const;
      const oldUpdateCount = queryClient.getQueryState(authKey)?.dataUpdateCount ?? -1;
      await queryClient.refetchQueries({ queryKey: authKey, exact: true, type: 'active' });
      const newState = queryClient.getQueryState(authKey);
      const refreshedUser = queryClient.getQueryData<{
        id: string;
        political_consent?: { granted: boolean; timestamp: string | null } | null;
      }>(authKey);
      const epoch = refreshedUser?.political_consent?.timestamp;
      if (getAuthToken() !== authToken ||
          newState === undefined || newState.dataUpdateCount <= oldUpdateCount ||
          refreshedUser?.id !== expectedOwner ||
          refreshedUser?.political_consent?.granted !== true ||
          typeof epoch !== 'string' || !epoch.trim()) {
        // Do not auto-save a pending political answer on an unverified session.
        throw new Error("Consenso registrato, ma impossibile verificare la nuova sessione. Riapri la pagina.");
      }
      // The verified /auth/me response is now the only consent authority.
      // Refresh the dedicated query in RAM without any redundant network read.
      queryClient.setQueryData(['political-opinions-consent', expectedOwner], {
        success: true,
        consent: { granted: true, timestamp: epoch, ipAddress: null, userAgent: null },
      });
      void queryClient.invalidateQueries({ queryKey: ['profileConsent'] });

      toast({
        title: "Consenso salvato",
        description: "Puoi ora esprimere le tue opinioni politiche sulla piattaforma.",
      });

      onConsentGranted?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio del consenso. Riprova più tardi.",
        variant: "destructive",
      });
    }
  });

  const handleAccept = () => {
    if (!consentChecked) {
      toast({
        title: "Consenso richiesto",
        description: "Devi accettare il consenso per procedere.",
        variant: "destructive",
      });
      return;
    }
    
    consentMutation.mutate(true);
  };

  const handleDecline = () => {
    onOpenChange(false);
    toast({
      title: "Consenso non concesso",
      description: "Non potrai esprimere opinioni politiche, ma potrai utilizzare tutte le altre funzionalità della piattaforma.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <DialogTitle className="text-2xl font-bold">
              Consenso al Trattamento delle Opinioni Politiche
            </DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Secondo il GDPR Art. 9, le opinioni politiche sono "dati particolari" 
            che richiedono il tuo consenso esplicito.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alert informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Perché serve il tuo consenso?
                </h4>
                <p className="text-sm text-blue-800 mb-3">
                  Le opinioni politiche sono considerate dati particolari secondo il GDPR 
                  (Regolamento Generale sulla Protezione dei Dati). Per raccogliere e 
                  trattare questi dati, è necessario il tuo <strong>consenso esplicito</strong>.
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Il consenso è opzionale:</strong> Se rifiuti, non potrai esprimere 
                  opinioni politiche ma potrai utilizzare tutte le altre funzionalità della piattaforma.
                </p>
              </div>
            </div>
          </div>

          {/* Informazioni sul trattamento */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">
              Come utilizziamo le tue opinioni politiche:
            </h4>
            <ul className="list-disc pl-6 space-y-2 text-sm text-gray-700">
              <li>Permettere l'espressione della tua opinione su temi politici</li>
              <li>Generare statistiche aggregate e anonime sull'opinione pubblica</li>
              <li>Confrontare le tue opinioni con quelle dei rappresentanti politici</li>
              <li>Migliorare la piattaforma di democrazia partecipativa</li>
            </ul>
          </div>

          {/* Garanzie */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">
              Le tue garanzie:
            </h4>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700">
              <li>Puoi <strong>revocare il consenso in qualsiasi momento</strong> dalle impostazioni del profilo</li>
              <li>In caso di revoca, viene avviata la cancellazione delle risposte personali attive; le eventuali copie di sicurezza seguono procedure distinte, come indicato nella Privacy Policy</li>
              <li>Le tue opinioni <strong>individuali non vengono vendute o condivise</strong> con partiti politici, organizzazioni o terze parti, e <strong>non vengono utilizzate</strong> per targeting pubblicitario o scopi commerciali</li>
              <li>Le <strong>statistiche aggregate e anonime</strong> (non identificabili) possono essere condivise con giornalisti, ricercatori e organizzazioni per ricerca, analisi e informazione pubblica</li>
              <li>I dati sono protetti con <strong>crittografia</strong> e misure di sicurezza avanzate</li>
            </ul>
          </div>

          {/* Link alla Privacy Policy */}
          <div className="text-sm text-gray-600">
            Per maggiori informazioni, consulta la nostra{" "}
            <Link 
              href="/privacy-policy" 
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
              target="_blank"
            >
              Privacy Policy
              <ExternalLink className="h-3 w-3" />
            </Link>
            , in particolare la sezione 4.1 "Trattamento di Dati Particolari - Opinioni Politiche (GDPR Art. 9)".
          </div>

          {/* Checkbox consenso */}
          <div className="flex items-start space-x-3 pt-4 border-t">
            <Checkbox
              id="political-consent"
              checked={consentChecked}
              onCheckedChange={(checked) => setConsentChecked(checked === true)}
              className="mt-1"
            />
            <label
              htmlFor="political-consent"
              className="text-sm leading-relaxed cursor-pointer"
            >
              <strong>Consento esplicitamente</strong> al trattamento delle mie opinioni politiche 
              secondo quanto specificato nella Privacy Policy (GDPR Art. 9.2.a). 
              Comprendo che posso revocare questo consenso in qualsiasi momento.
            </label>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={consentMutation.isPending}
            className="w-full sm:w-auto"
          >
            Rifiuta
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!consentChecked || consentMutation.isPending}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            {consentMutation.isPending ? (
              <>
                <span className="mr-2">⏳</span>
                Salvataggio...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Accetta e Continua
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

