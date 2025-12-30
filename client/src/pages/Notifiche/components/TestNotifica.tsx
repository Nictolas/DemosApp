import React from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Bell, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export const TestNotifica: React.FC = () => {
  const { toast } = useToast();

  const testPushNotification = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fcm-tokens/test");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'invio della notifica di test");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Notifica di test inviata",
        description: data.message || "La notifica di test è stata inviata con successo al tuo dispositivo.",
        duration: 5000
      });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica di test:", error);
      toast({
        title: "Errore",
        description: error.message || "Invio fallito. Riprova più tardi.",
        variant: "destructive"
      });
    },
  });

  return (
    <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-blue-600" />
          Test Notifiche Push
        </CardTitle>
        <CardDescription>
          Invia una notifica di test al tuo dispositivo per verificare che le notifiche push funzionino correttamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Bell className="h-4 w-4" />
          <AlertDescription>
            Assicurati di aver concesso i permessi per le notifiche push nel browser/app e di aver attivato le notifiche nelle preferenze.
          </AlertDescription>
        </Alert>
        
        <Button
          onClick={() => testPushNotification.mutate()}
          disabled={testPushNotification.isPending}
          className="w-full"
          variant="default"
        >
          {testPushNotification.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Invio in corso...
            </>
          ) : (
            <>
              <Bell className="mr-2 h-4 w-4" />
              Invia Notifica di Test
            </>
          )}
        </Button>

        {testPushNotification.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {testPushNotification.error?.message || "Errore nell'invio della notifica di test"}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

