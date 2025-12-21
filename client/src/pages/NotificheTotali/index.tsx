import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Bell } from "lucide-react";

export default function NotificheTotali() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Query per recuperare tutte le notifiche
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifiche-totali'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifiche-totali");
      if (!response?.ok || !response?.data) {
        throw new Error("Errore nel caricamento delle notifiche");
      }
      return response.data;
    },
    enabled: !!user,
    refetchInterval: 60000, // Ricarica ogni minuto
  });

  if (isAuthLoading) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Verifica se l'utente è admin
  const isAdmin = user?.ruolo === "AD" || user?.is_admin === true;

  if (!isAdmin) {
    return (
      <PageContainer className="flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Accesso Negato</CardTitle>
            <CardDescription>
              Solo gli amministratori possono accedere a questa pagina.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto w-full">
        <Card className="bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-pink-600" />
              <CardTitle>Notifiche Totali</CardTitle>
            </div>
            <CardDescription>
              Visualizza tutte le notifiche del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">
                Errore nel caricamento delle notifiche: {error.message}
              </div>
            ) : !data || !data.notifiche || data.notifiche.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Nessuna notifica disponibile</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <Card className="bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-blue-600">
                        {data.stats?.voti_comuni || 0}
                      </div>
                      <div className="text-sm text-gray-600">Notifiche Voti Comuni</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-pink-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-pink-600">
                        {data.stats?.demos || 0}
                      </div>
                      <div className="text-sm text-gray-600">Notifiche Demos</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-green-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">
                        {data.stats?.comunali || 0}
                      </div>
                      <div className="text-sm text-gray-600">Notifiche Comunali</div>
                    </CardContent>
                  </Card>
                </div>
                <div className="space-y-2">
                  {data.notifiche.map((notifica: any) => (
                    <Card key={notifica.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {notifica.titolo || 'Nessun titolo'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {notifica.testo || notifica.messaggio || 'Nessun messaggio'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Tabella: {notifica.tabella_origine || 'N/A'}</span>
                              <span>
                                Data: {notifica.data 
                                  ? new Date(notifica.data).toLocaleDateString('it-IT')
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

