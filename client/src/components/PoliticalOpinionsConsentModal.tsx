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

  const consentMutation = useMutation({
    mutationFn: async (consent: boolean) => {
      const response = await apiRequest('POST', '/api/user/political-opinions-consent', {
        consent
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalida la cache per aggiornare lo stato del consenso
      queryClient.invalidateQueries({ queryKey: ['political-opinions-consent'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      
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
      description: "Le funzioni basate sulle tue opinioni politiche non saranno disponibili. Puoi comunque consultare le informazioni pubbliche e gestire il tuo account.",
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
                  <strong>Il consenso è opzionale:</strong> Se rifiuti, non potrai salvare opinioni o voti politici, scegliere candidati e rappresentanti o ricevere confronti personalizzati. Potrai consultare informazioni pubbliche e gestire il tuo account.
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
              <li>In caso di revoca, i dati politici coperti dal consenso saranno <strong>cancellati secondo le regole applicabili</strong> e non saranno più usati per personalizzazioni</li>
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

