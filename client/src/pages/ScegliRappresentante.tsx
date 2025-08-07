import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check, User, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { PageTransition } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { useFCM } from "@/hooks/useFCM";
// === AGGIUNTO ===
import { apiRequest } from "@/lib/queryClient";

// L'interfaccia rimane quasi uguale, non serve cambiarla
interface Rappresentante {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_elezione?: string;
  opinioni_comuni: number;
  avatar_config?: string;
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
}

export default function ScegliRappresentante() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const authReady = useAuthReady();
  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [selezionando, setSelezionando] = useState(false);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);
  const [opinioniDialogData, setOpinioniDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string} | null>(null);
  const { token: fcmToken } = useFCM();
  
  const getTitolo = (): string => {
    switch (categoria) {
      case "europeo": return "Europeo";
      case "camera": return "Nazionale";
      case "senato": return "Nazionale";
      case "regione": return "Regionale";
      case "comune": return "Comunale";
      default: return "Rappresentante";
    }
  };
  
  const getFieldName = (): string => {
    switch (categoria) {
      case "europeo": return "rappresentante_europeo";
      case "camera": return "rappresentante_camera";
      case "senato": return "rappresentante_senato";
      case "regione": return "rappresentante_regionale";
      case "comune": return "rappresentante_comunale";
      default: return "";
    }
  };

  // === INIZIO MODIFICHE PRINCIPALI ===
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // 1. Carica i dati dell'utente corrente e i politici/candidati tramite API
        // Usiamo un endpoint che fa tutto il lavoro pesante lato server
        const response = await apiRequest(
          "GET", 
          `/api/rappresentanti?grado=${encodeURIComponent(getTitolo())}&categoria=${encodeURIComponent(categoria || '')}`
        );

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati dal server.");
        }
        
        const { candidati, utente } = await response.json();
        
        // 2. Imposta i dati ricevuti
        setRappresentanteSelezionato(utente[getFieldName()] || null);
        
        // 3. La logica di calcolo delle opinioni e shuffle ora è lato backend.
        // Riceviamo già la lista pronta da visualizzare.
        setRappresentanti(candidati);

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, toast]); // Dipendenze corrette

  const selezionaRappresentante = async (rappresentanteId: string) => {
    if (!user) return;
    
    setSelezionando(true);
    try {
      // 4. Aggiorna la selezione tramite API
      const updateResponse = await apiRequest(
        "PUT",
        `/api/users/${user.uid}/seleziona-rappresentante`,
        {
          campo: getFieldName(),
          rappresentanteId: rappresentanteId,
        }
      );

      if (!updateResponse.ok) {
        throw new Error("Impossibile aggiornare la selezione.");
      }
      
      setRappresentanteSelezionato(rappresentanteId);

      // La logica FCM rimane uguale, ma usa apiRequest per coerenza
      if (fcmToken) {
        const topic = `sostenitori_politico_${rappresentanteId}`;
        await apiRequest(
            "POST",
            "/api/notifications/subscribe-topic",
            { token: fcmToken, topic }
        );
        toast({
            title: "Notifiche attivate",
            description: `Riceverai notifiche push per questo rappresentante.`,
            variant: "success"
        });
      }

      toast({
        title: "Successo",
        description: "Rappresentante selezionato con successo!",
      });

    } catch (error) {
      console.error("Errore durante la selezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile selezionare il rappresentante.",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };
  // === FINE MODIFICHE PRINCIPALI ===

  if (!authReady || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Il resto del codice JSX per la visualizzazione rimane quasi identico
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col mb-6">
          <div className="flex items-center mb-2">
            <Button variant="ghost" className="mr-2" asChild>
              <Link to="/rappresentanti">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Scegli Rappresentante {getTitolo()}</h1>
          </div>
        </div>
        
        <ViewOpinioniDialog
          open={!!opinioniDialogData}
          onOpenChange={(open) => { if (!open) setOpinioniDialogData(null); }}
          utenteId={opinioniDialogData?.utenteId || ''}
          nome={opinioniDialogData?.nome}
          cognome={opinioniDialogData?.cognome}
          avatarConfig={opinioniDialogData?.avatarConfig}
        />
        
        {rappresentanti.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Nessun rappresentante trovato</h2>
              <p className="text-muted-foreground mb-4">
                Non ci sono rappresentanti disponibili per la categoria "{getTitolo()}" nella tua zona.
              </p>
              <Button asChild>
                <Link to="/menu">Torna al Menu</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
            {rappresentanti.map((rappresentante) => {
              const isSelected = rappresentante.id === rappresentanteSelezionato;
              let avatarContent;
              try {
                if (rappresentante.avatar_config) {
                  const config = JSON.parse(rappresentante.avatar_config);
                  avatarContent = (
                    <CustomAvatar 
                      config={config}
                      size={80}
                      className="w-full h-full"
                    />
                  );
                }
              } catch (error) {
                // Silently fail, fallback will be used
              }
              if (!avatarContent) {
                avatarContent = <User className="h-10 w-10 text-gray-400" />;
              }
              return (
                <div key={rappresentante.id} 
                     className={`relative w-full rounded-2xl shadow-lg overflow-hidden bg-white flex flex-col items-center py-6 px-4 transition-all duration-300 ${isSelected ? 'border-4 border-green-500' : 'border-2 border-transparent'}`}>
                  
                  {isSelected && <Badge className="absolute top-2 right-2 bg-green-500">Selezionato</Badge>}

                  <div className="rounded-full overflow-hidden border-2 border-gray-300 shadow-sm cursor-pointer h-20 w-20 flex items-center justify-center bg-gray-100"
                    onClick={() => setOpinioniDialogData({ utenteId: rappresentante.id, nome: rappresentante.nome, cognome: rappresentante.cognome, avatarConfig: rappresentante.avatar_config })}
                  >
                    {avatarContent}
                  </div>
                  <div className="text-center mt-2">
                    <p className="font-medium text-primary cursor-pointer hover:underline text-lg" onClick={() => setOpinioniDialogData({ utenteId: rappresentante.id, nome: rappresentante.nome, cognome: rappresentante.cognome, avatarConfig: rappresentante.avatar_config })}>
                      {rappresentante.nome} {rappresentante.cognome}
                    </p>
                    <div className="flex justify-center space-x-2 mt-1">
                      <Badge variant="secondary">{rappresentante.opinioni_comuni} opinioni comuni</Badge>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => selezionaRappresentante(rappresentante.id)}
                    disabled={selezionando || isSelected}
                  >
                    {selezionando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isSelected ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <ThumbsUp className="mr-2 h-4 w-4" />
                    )}
                    {isSelected ? 'Scelto' : 'Scegli'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}