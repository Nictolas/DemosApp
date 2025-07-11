import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function GestisciIniziativePopolari() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<Array<{id: string, nome: string, urlProva: string, userId: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest('GET', "/api/iniziative-popolari/richieste");
      if (!res.ok) throw new Error("Errore nel recupero delle richieste");
      setRequests(await res.json());
    } catch (e) {
      setError("Errore nel caricamento delle richieste");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const handleAction = async (id: string, action: 'accetta' | 'rifiuta') => {
    setActionLoading(id + action);
    setError("");
    try {
      const res = await apiRequest('POST', `/api/iniziative-popolari/${id}/${action}`);
      if (!res.ok) throw new Error("Errore nell'azione");
      await fetchRequests();
    } catch (e) {
      setError("Errore nell'azione sulla richiesta");
    } finally {
      setActionLoading("");
    }
  };

  const safeRequests = Array.isArray(requests) ? requests : [];

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Show loading while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Check if user is admin
  if (user && user.ruolo !== 'Admin') {
    return <Redirect to="/menu" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <div className="container mx-auto max-w-4xl">
        <Link href="/gestisci">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci
          </Button>
        </Link>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center text-2xl">
              <Users className="h-6 w-6" /> Gestisci Iniziative Popolari
            </CardTitle>
            <CardDescription>Approva o rifiuta le richieste di iniziative popolari proposte dagli utenti</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : safeRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500"><Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nessuna richiesta pending.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Periodo</TableHead>
                      <TableHead>Sito Web</TableHead>
                      <TableHead>Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeRequests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell>{new Date(r.dataInizio).toLocaleDateString('it-IT')} - {new Date(r.dataFine).toLocaleDateString('it-IT')}</TableCell>
                        <TableCell>{r.sitoWeb ? (<a href={r.sitoWeb} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"><span>Visita</span></a>) : "N/A"}</TableCell>
                        <TableCell className="flex gap-2">
                          <Button size="sm" variant="default" onClick={() => handleAction(r.id, 'accetta')} disabled={actionLoading === r.id + 'accetta'}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="destructive" onClick={() => handleAction(r.id, 'rifiuta')} disabled={actionLoading === r.id + 'rifiuta'}><X className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 