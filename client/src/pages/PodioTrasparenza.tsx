import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Star } from "lucide-react";

interface PodioUser {
  id_utente: string;
  nome: string;
  cognome: string;
  ruolo: string;
  punti_trasparenza_totali: number;
  numero_comunicazioni: number;
}

export default function PodioTrasparenza() {
  const { data: podioUsers, isLoading, error } = useQuery({
    queryKey: ["/api/podio-trasparenza"],
  });

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-5 w-5 text-blue-500" />;
    }
  };

  const getRankColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-linear-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900/20 dark:to-yellow-800/10 border-yellow-200 dark:border-yellow-800";
      case 2:
        return "bg-linear-to-r from-gray-100 to-gray-50 dark:from-gray-800/20 dark:to-gray-700/10 border-gray-200 dark:border-gray-700";
      case 3:
        return "bg-linear-to-r from-amber-100 to-amber-50 dark:from-amber-900/20 dark:to-amber-800/10 border-amber-200 dark:border-amber-800";
      default:
        return "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 page-with-navbar">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Podio Trasparenza</h1>
              <p className="text-muted-foreground">Caricamento classifica...</p>
            </div>
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        <div className="space-y-2">
                          <div className="w-48 h-4 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
                          <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
                        </div>
                      </div>
                      <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
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

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 page-with-navbar">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6 text-center">
              <p className="text-red-600 dark:text-red-400">
                Errore nel caricamento della classifica. Riprova più tardi.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Podio Trasparenza
            </h1>
            <p className="text-muted-foreground">
              I rappresentanti più trasparenti del sistema democratico
            </p>
          </div>

          {!podioUsers || (podioUsers as any[]).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna comunicazione ancora</h3>
                <p className="text-muted-foreground">
                  Il podio verrà popolato quando i rappresentanti inizieranno a comunicare le loro votazioni.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(podioUsers as any[]).map((user: PodioUser, index: number) => {
                const position = index + 1;
                
                return (
                  <Card 
                    key={user.id_utente} 
                    className={`transition-all duration-200 hover:shadow-lg ${getRankColor(position)}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            {getRankIcon(position)}
                            <span className="text-2xl font-bold text-muted-foreground">
                              #{position}
                            </span>
                          </div>
                          
                          <div>
                            <h3 className="text-lg font-semibold">
                              {user.nome} {user.cognome}
                            </h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {user.ruolo}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {user.numero_comunicazioni} comunicazioni
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {user.punti_trasparenza_totali}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            punti trasparenza
                          </div>
                        </div>
                      </div>
                      
                      {position <= 3 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-center space-x-2">
                            {position === 1 && (
                              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                                🏆 Campione di Trasparenza
                              </span>
                            )}
                            {position === 2 && (
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                🥈 Secondo Posto
                              </span>
                            )}
                            {position === 3 && (
                              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                🥉 Terzo Posto
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Come funziona il Podio Trasparenza</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Punti Trasparenza:</strong> I rappresentanti guadagnano punti comunicando le loro votazioni.
              </p>
              <p>
                <strong>3 punti:</strong> Per essere il primo a comunicare una votazione in una specifica zona.
              </p>
              <p>
                <strong>1 punto:</strong> Per comunicare una votazione già comunicata da altri nella stessa zona.
              </p>
              <p>
                La classifica viene aggiornata automaticamente ad ogni nuova comunicazione.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
