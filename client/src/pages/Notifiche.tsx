import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, Bell, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Notifica {
  id: string;
  comunicazione_id: string;
  destinatario_id: string;
  rappresentante_nome: string;
  rappresentante_cognome: string;
  titolo: string;
  voto_dato: string;
  commento?: string;
  vincitore: string;
  data_creazione: string;
  user_reaction?: "like" | "dislike" | null;
}

export default function Notifiche() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingReaction, setProcessingReaction] = useState<string | null>(null);

  const { data: notifiche, isLoading } = useQuery({
    queryKey: ["/api/notifiche"],
    enabled: !!user,
  });



  // React to communication (like/dislike)
  const reactToCommunication = useMutation({
    mutationFn: async ({ comunicazioneId, reaction }: { comunicazioneId: string; reaction: "like" | "dislike" }) => {
      const response = await fetch(`/api/comunicazioni/${comunicazioneId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      if (!response.ok) throw new Error("Errore nella reazione");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifiche"] });
      setProcessingReaction(null);
      toast({
        title: "Reazione registrata",
        description: `Hai ${variables.reaction === "like" ? "messo mi piace" : "messo non mi piace"} alla comunicazione.`,
      });
    },
    onError: (error: any) => {
      setProcessingReaction(null);
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore nella reazione.",
        variant: "destructive",
      });
    },
  });

  const handleReaction = (comunicazioneId: string, reaction: "like" | "dislike") => {
    setProcessingReaction(comunicazioneId);
    reactToCommunication.mutate({ comunicazioneId, reaction });
  };

  const getReactionColor = (reaction: string | null) => {
    switch (reaction) {
      case "like":
        return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20";
      case "dislike":
        return "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20";
      default:
        return "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Notifiche</h1>
              <p className="text-muted-foreground">Caricamento notifiche...</p>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="flex space-x-2">
                        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
              <Bell className="h-8 w-8" />
              Notifiche
            </h1>
            <p className="text-muted-foreground">
              Le comunicazioni dei tuoi rappresentanti
            </p>
          </div>

          {!notifiche || (notifiche as any[]).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna notifica</h3>
                <p className="text-muted-foreground">
                  Riceverai notifiche quando i tuoi rappresentanti comunicheranno nuove votazioni.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(notifiche as any[]).map((notifica: Notifica) => (
                <Card 
                  key={notifica.id} 
                  className="transition-all duration-200 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <User className="h-5 w-5 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">
                            {notifica.rappresentante_nome} {notifica.rappresentante_cognome}
                          </CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(notifica.data_creazione), {
                                addSuffix: true,
                                locale: it,
                              })}
                            </span>
                            {!notifica.letta && (
                              <Badge variant="secondary" className="text-xs">
                                Nuova
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 border">
                      <p className="font-medium mb-2">
                        ha comunicato una votazione: <strong>{notifica.titolo}</strong>
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ha votato:</span>
                          <Badge 
                            variant="outline" 
                            className={`ml-2 ${
                              notifica.voto_dato === "Favorevole" 
                                ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                                : notifica.voto_dato === "Contrario"
                                ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                                : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                            }`}
                          >
                            {notifica.voto_dato}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ha vinto:</span>
                          <Badge 
                            variant="outline" 
                            className={`ml-2 ${
                              notifica.vincitore === "Favorevole" 
                                ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                                : notifica.vincitore === "Contrario"
                                ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                                : "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400"
                            }`}
                          >
                            {notifica.vincitore}
                          </Badge>
                        </div>
                      </div>
                      
                      {notifica.commento && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <span className="text-muted-foreground text-sm">Commento:</span>
                          <p className="text-sm font-medium mt-1 italic">"{notifica.commento}"</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Cosa ne pensi di questa comunicazione?
                      </span>
                      
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReaction(notifica.comunicazione_id, "like")}
                          disabled={processingReaction === notifica.comunicazione_id}
                          className={notifica.user_reaction === "like" ? getReactionColor("like") : ""}
                        >
                          <ThumbsUp className="h-4 w-4 mr-1" />
                          Mi piace
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReaction(notifica.comunicazione_id, "dislike")}
                          disabled={processingReaction === notifica.comunicazione_id}
                          className={notifica.user_reaction === "dislike" ? getReactionColor("dislike") : ""}
                        >
                          <ThumbsDown className="h-4 w-4 mr-1" />
                          Non mi piace
                        </Button>
                      </div>
                    </div>

                    {notifica.user_reaction && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-muted-foreground">
                          Hai già reagito a questa comunicazione con: 
                          <Badge 
                            variant="outline" 
                            className={`ml-2 ${getReactionColor(notifica.user_reaction)}`}
                          >
                            {notifica.user_reaction === "like" ? "Mi piace" : "Non mi piace"}
                          </Badge>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}