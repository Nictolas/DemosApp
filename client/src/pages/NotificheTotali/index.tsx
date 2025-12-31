import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Bell, Vote, Building2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Componente per la tabella delle notifiche
function NotificheTable({ notifiche, tipo }: { notifiche: any[]; tipo: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteMutation = useMutation({
    mutationFn: async ({ id, tabella }: { id: string; tabella: string }) => {
      const response = await apiRequest("DELETE", `/api/notifiche-totali/${tabella}/${id}`);
      if (!response?.ok) {
        throw new Error("Errore nella cancellazione della notifica");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifiche-totali'] });
      toast({
        title: "Successo",
        description: "Notifica cancellata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella cancellazione della notifica",
        variant: "destructive",
      });
    }
  });
  
  const handleDelete = (id: string, tabella: string) => {
    if (window.confirm("Sei sicuro di voler cancellare questa notifica?")) {
      deleteMutation.mutate({ id, tabella });
    }
  };
  
  if (notifiche.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Nessuna notifica disponibile</p>
      </div>
    );
  }

  const getTableHeaders = () => {
    if (tipo === 'voti_comuni') {
      return (
        <>
          <TableHead>ID</TableHead>
          <TableHead>Titolo</TableHead>
          <TableHead>Testo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Voto</TableHead>
          <TableHead>Politico</TableHead>
          <TableHead>Comune</TableHead>
          <TableHead>Likes</TableHead>
          <TableHead>Dislikes</TableHead>
          <TableHead>Azioni</TableHead>
        </>
      );
    } else if (tipo === 'demos') {
      return (
        <>
          <TableHead>ID</TableHead>
          <TableHead>Titolo</TableHead>
          <TableHead>Testo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Azioni</TableHead>
        </>
      );
    } else if (tipo === 'avvistamenti') {
      return (
        <>
          <TableHead>ID</TableHead>
          <TableHead>Tipo Avvistamento</TableHead>
          <TableHead>Comune</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Azioni</TableHead>
        </>
      );
    } else {
      // Tipo comunali - senza likes/dislikes
      return (
        <>
          <TableHead>ID</TableHead>
          <TableHead>Titolo</TableHead>
          <TableHead>Testo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Comune</TableHead>
          <TableHead>Azioni</TableHead>
        </>
      );
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {getTableHeaders()}
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifiche.map((notifica: any) => (
            <TableRow key={notifica.id}>
              <TableCell className="font-mono text-xs">
                {notifica.id?.substring(0, 8)}...
              </TableCell>
              {tipo === 'avvistamenti' ? (
                <>
                  <TableCell className="font-medium">
                    {notifica.titolo || notifica.tipo_avvistamento || 'Nessun tipo'}
                  </TableCell>
                  <TableCell>
                    {notifica.comune_residenza || '-'}
                  </TableCell>
                  <TableCell>
                    {notifica.data || notifica.data_creazione
                      ? new Date(notifica.data || notifica.data_creazione).toLocaleDateString('it-IT')
                      : 'N/A'}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="font-medium">
                    {notifica.titolo || 'Nessun titolo'}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-gray-600 truncate">
                      {notifica.testo || notifica.messaggio || 'Nessun messaggio'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {notifica.data 
                      ? new Date(notifica.data).toLocaleDateString('it-IT')
                      : 'N/A'}
                  </TableCell>
                </>
              )}
              {tipo === 'voti_comuni' && (
                <>
                  <TableCell>
                    {notifica.voto ? (
                      <span className={`px-2 py-1 rounded text-xs ${
                        notifica.voto === 'Favorevole' ? 'bg-green-100 text-green-800' :
                        notifica.voto === 'Contrario' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {notifica.voto}
                      </span>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{notifica.politico || '-'}</TableCell>
                </>
              )}
              {tipo !== 'demos' && (
                <TableCell>{notifica.comune_residenza || '-'}</TableCell>
              )}
              {tipo === 'voti_comuni' && (
                <>
                  <TableCell>{notifica.likes || 0}</TableCell>
                  <TableCell>{notifica.dislikes || 0}</TableCell>
                </>
              )}
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(notifica.id, tipo)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

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
      <div className="w-full">
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                  <Card className="bg-purple-50">
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-purple-600">
                        {data.stats?.avvistamenti || 0}
                      </div>
                      <div className="text-sm text-gray-600">Notifiche Avvistamenti</div>
                    </CardContent>
                  </Card>
                </div>
                
                <Tabs defaultValue="voti-comuni" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="voti-comuni" className="flex items-center gap-2">
                      <Vote className="h-4 w-4" />
                      Voti Comuni ({data.stats?.voti_comuni || 0})
                    </TabsTrigger>
                    <TabsTrigger value="demos" className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Demos ({data.stats?.demos || 0})
                    </TabsTrigger>
                    <TabsTrigger value="comunali" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Comunali ({data.stats?.comunali || 0})
                    </TabsTrigger>
                    <TabsTrigger value="avvistamenti" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Avvistamenti ({data.stats?.avvistamenti || 0})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="voti-comuni" className="mt-6">
                    <NotificheTable 
                      notifiche={data.notifiche?.voti_comuni || []} 
                      tipo="voti_comuni"
                    />
                  </TabsContent>
                  
                  <TabsContent value="demos" className="mt-6">
                    <NotificheTable 
                      notifiche={data.notifiche?.demos || []} 
                      tipo="demos"
                    />
                  </TabsContent>
                  
                  <TabsContent value="comunali" className="mt-6">
                    <NotificheTable 
                      notifiche={data.notifiche?.comunali || []} 
                      tipo="comunali"
                    />
                  </TabsContent>
                  
                  <TabsContent value="avvistamenti" className="mt-6">
                    <NotificheTable 
                      notifiche={data.notifiche?.avvistamenti || []} 
                      tipo="avvistamenti"
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

