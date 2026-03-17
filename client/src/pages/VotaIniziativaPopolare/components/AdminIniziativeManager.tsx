import React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Check, X, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface IniziativaRequest {
  id: string;
  nome: string;
  dataInizio: string;
  dataFine: string;
  sitoWeb?: string;
}

interface AdminIniziativeManagerProps {
  userRole?: string;
  userEmail?: string;
}

export function AdminIniziativeManager({ userRole, userEmail }: AdminIniziativeManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Solo gli Admin possono vedere questo componente
  // Controlla tutti i possibili formati del ruolo Admin
  const isAdminByRole = userRole === 'AD' || 
                        userRole === 'admin' || 
                        userRole === 'ADMIN' ||
                        userRole?.toLowerCase() === 'admin';
  
  // Lista degli Admin noti per fallback
  const knownAdmins = [
    'nicolasmicheletti90@gmail.com',
    'admin@demos.community'
  ];
  
  const isAdminByEmail = userEmail && knownAdmins.includes(userEmail);
  
  const isAdmin = isAdminByRole || isAdminByEmail;
  
  if (!isAdmin) {
    return null;
  }

  // 1. Caricamento delle richieste con React Query
  const { data: requests = [], isLoading, isError, error } = useQuery<IniziativaRequest[]>({
    queryKey: ['iniziativePopolariRequests'],
    queryFn: async () => {
      const response = await apiRequest('GET', "/api/iniziative-popolari/richieste");
      if (!response.ok) throw new Error("Errore nel recupero delle richieste");
      return response.json();
    },
    enabled: userRole === 'AD', // Esegui solo se l'utente è Admin
  });

  // 2. Mutazione per gestire le azioni (accetta/rifiuta)
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accetta' | 'rifiuta' }) =>
      apiRequest('POST', `/api/iniziative-popolari/${id}/${action}`),
    onSuccess: (_, { action }) => {
      toast({ 
        title: "Successo", 
        description: `Richiesta ${action === 'accetta' ? 'accettata' : 'rifiutata'}.` 
      });
      // Invalida la query per forzare un ricaricamento automatico della lista
      queryClient.invalidateQueries({ queryKey: ['iniziativePopolariRequests'] });
    },
    onError: () => {
      toast({ 
        title: "Errore", 
        description: "L'azione sulla richiesta è fallita.", 
        variant: "destructive" 
      });
    },
  });

  return (
    <Card className="border-2 border-amber-200 bg-white">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center gap-2 justify-center text-xl text-amber-800">
          <Users className="h-5 w-5" /> Gestisci Iniziative Popolari
        </CardTitle>
        <CardDescription className="text-amber-700">
          Approva o rifiuta le richieste di iniziative popolari proposte dagli utenti
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
          </div>
        ) : isError ? (
          <div className="text-center text-red-500 py-8">
            {(error as Error).message}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-amber-600">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessuna richiesta pending.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-100">
                  <TableHead className="text-amber-800 font-semibold">Nome</TableHead>
                  <TableHead className="text-amber-800 font-semibold">Periodo</TableHead>
                  <TableHead className="text-amber-800 font-semibold">Sito Web</TableHead>
                  <TableHead className="text-right text-amber-800 font-semibold">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id} className="hover:bg-amber-50">
                    <TableCell className="font-medium text-amber-900">
                      {r.nome}
                    </TableCell>
                    <TableCell className="text-amber-800">
                      {new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell>
                      {r.sitoWeb ? (
                        <a 
                          href={r.sitoWeb} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Visita
                        </a>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => actionMutation.mutate({ id: r.id, action: 'accetta' })} 
                        disabled={actionMutation.isPending}
                      >
                        {actionMutation.isPending && 
                         actionMutation.variables?.id === r.id && 
                         actionMutation.variables?.action === 'accetta' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => actionMutation.mutate({ id: r.id, action: 'rifiuta' })} 
                        disabled={actionMutation.isPending}
                      >
                        {actionMutation.isPending && 
                         actionMutation.variables?.id === r.id && 
                         actionMutation.variables?.action === 'rifiuta' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

