import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth-neon";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EmergencyNumber {
  number: string;
  label: string;
  description?: string;
}

interface EmergencyCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  numbers: EmergencyNumber[];
}

interface EmergencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: EmergencyCategory;
}

export const EmergencyDialog: React.FC<EmergencyDialogProps> = ({
  open,
  onOpenChange,
  category,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNotifying, setIsNotifying] = useState(false);

  const handleCall = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  const handleNotifyNeighbors = async () => {
    if (!user?.id || !user?.comune_residenza) {
      toast({
        title: "Errore",
        description: "Impossibile inviare la notifica. Verifica di avere un comune di residenza nel tuo profilo.",
        variant: "destructive"
      });
      return;
    }

    setIsNotifying(true);
    try {
      const response = await apiRequest("POST", "/api/avvistamenti/avvisa-vicini", {
        tipo_avvistamento: category.title,
        titolo: `Un cittadino ha segnalato un avvistamento di ${category.title.toLowerCase()} nel comune di ${user.comune_residenza}. Presta attenzione se ti trovi nella zona.`
      });

      if (response?.ok) {
        toast({
          title: "Notifica inviata",
          description: `I cittadini del tuo comune (${user.comune_residenza}) sono stati avvisati dell'avvistamento.`
        });
      } else {
        const data = await response?.json?.() || {};
        throw new Error(data.error || "Errore nell'invio della notifica");
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la notifica. Riprova più tardi.",
        variant: "destructive"
      });
    } finally {
      setIsNotifying(false);
    }
  };

  const isLupo = category.id === "lupi";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">{category.icon}</span>
            <span>{category.title}</span>
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {category.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {category.numbers.map((emergencyNumber, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Button
                onClick={() => handleCall(emergencyNumber.number)}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
              >
                <Phone className="h-5 w-5" />
                <span>{emergencyNumber.label}</span>
              </Button>
              {emergencyNumber.description && (
                <p className="text-sm text-gray-600 text-center">
                  {emergencyNumber.description}
                </p>
              )}
            </div>
          ))}
          
          {/* Pulsante "Avvisa vicini" solo per Lupo */}
          {isLupo && (
            <div className="flex flex-col gap-2 pt-2 border-t">
              <Button
                onClick={handleNotifyNeighbors}
                disabled={isNotifying}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isNotifying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Invio in corso...</span>
                  </>
                ) : (
                  <>
                    <Bell className="h-5 w-5" />
                    <span>Avvisa vicini</span>
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-600 text-center">
                Invia una notifica a tutti i cittadini del tuo comune
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

