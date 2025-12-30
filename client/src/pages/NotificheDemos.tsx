import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, ArrowLeft, Loader2, Send } from "lucide-react";

const demosNotificationSchema = z.object({
  titolo: z.string().min(1, "Il titolo è obbligatorio"),
  commento: z.string().min(1, "Il commento è obbligatorio"),
});

type DemosNotificationFormData = z.infer<typeof demosNotificationSchema>;

export default function NotificheDemos() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const demosForm = useForm<DemosNotificationFormData>({
    resolver: zodResolver(demosNotificationSchema),
    defaultValues: {
      titolo: "",
      commento: "",
    },
  });

  // Mutazione per le notifiche di Demos
  const submitDemosNotification = useMutation({
    mutationFn: async (data: DemosNotificationFormData) => {
      if (!user?.id) {
        throw new Error('ID utente non disponibile. Riprova tra qualche secondo.');
      }
      
      const comunicazioneData = {
        titolo: data.titolo,
        commento: data.commento,
        zona: "Generale",
        id_utente: user.id,
        tipo: "demos_notification"
      };
      
      const response = await apiRequest("POST", "/api/comunicazioni", comunicazioneData);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore nell'invio della notifica");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Notifica inviata", 
        description: "La notifica di Demos è stata inviata a tutti gli utenti con le preferenze attivate." 
      });
      demosForm.reset();
      console.log('🔄 Invalidando notificationBadge dopo invio notifica Demos');
      queryClient.invalidateQueries({ queryKey: ['notificationBadge'] });
    },
    onError: (error: any) => {
      console.error("Errore nell'invio notifica Demos:", error);
      toast({ 
        title: "Errore", 
        description: error.message || "Invio fallito. Riprova più tardi.", 
        variant: "destructive" 
      });
    },
  });

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Verifica che l'utente sia admin
  const userRole = user?.ruolo;
  const isAdmin = userRole === "AD";

  if (!isAdmin) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            Accesso negato. Questa sezione è accessibile solo agli amministratori.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/gestisci")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="h-8 w-8 text-blue-600" />
              Notifiche Demos
            </h1>
            <p className="text-gray-600 mt-1">
              Invia notifiche push a tutti gli utenti con le preferenze "Demos" attivate
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Nuova Notifica Demos
            </CardTitle>
            <CardDescription>
              La notifica verrà inviata a tutti gli utenti che hanno attivato le notifiche "Demos" nelle loro preferenze.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...demosForm}>
              <form 
                onSubmit={demosForm.handleSubmit((data) => submitDemosNotification.mutate(data))} 
                className="space-y-6"
              >
                <FormField
                  control={demosForm.control}
                  name="titolo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titolo della notifica *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Es: Aggiornamento importante, Partecipa al sondaggio..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={demosForm.control}
                  name="commento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Messaggio *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Inserisci il messaggio completo per tutti gli utenti..."
                          rows={6}
                          className="resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <Bell className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Nota:</strong> La notifica verrà inviata solo agli utenti che hanno attivato 
                    le notifiche "Demos" nelle loro preferenze. Se una notifica Demos esiste già, verrà 
                    sovrascritta con questa nuova.
                  </AlertDescription>
                </Alert>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={submitDemosNotification.isPending}
                >
                  {submitDemosNotification.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Invia Notifica a Tutti
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}


