import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export default function GestisciGrazia() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [requests, setRequests] = useState<Array<{id: string, nome: string, urlProva: string, userId: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [userMap, setUserMap] = useState<Record<string, {nome: string, cognome: string}>>({});

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest('GET', "/api/grazia/richieste");
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

  useEffect(() => {
    // Quando cambiano le richieste, carica i dati pubblici degli utenti
    const fetchUsers = async () => {
      const ids = Array.from(new Set(requests.map(r => r.userId)));
      const newMap: Record<string, {nome: string, cognome: string}> = {};
      await Promise.all(ids.map(async (id) => {
        if (!id) return;
        try {
          const res = await apiRequest('GET', `/api/users/${id}/public`);
          if (res.ok) {
            const data = await res.json();
            newMap[id] = { nome: data.nome, cognome: data.cognome };
          }
        } catch {}
      }));
      setUserMap(newMap);
    };
    if (requests.length > 0) fetchUsers();
  }, [requests]);

  const handleAction = async (id: string, action: 'accetta' | 'rifiuta') => {
    setActionLoading(id + action);
    setError("");
    try {
      const res = await apiRequest('POST', `/api/grazia/richiesta/${id}/${action}`);
      if (!res.ok) throw new Error("Errore nell'azione");
      await fetchRequests();
    } catch (e) {
      setError("Errore nell'azione sull richiesta");
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-3xl">
        <Button variant="ghost" className="mb-4 flex items-center" onClick={() => setLocation("/gestisci")}> <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Gestisci </Button>
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full"><Heart className="h-10 w-10 text-white" /></div></div>
            <CardTitle className="text-2xl font-bold">Gestisci Grazia</CardTitle>
            <CardDescription>Gestisci le richieste di grazia e i voti associati</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Caricamento richieste...</div>
            ) : error ? (
              <div className="text-center text-red-500 py-8">{error}</div>
            ) : safeRequests.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Nessuna richiesta pendente.</div>
            ) : (
              <div className="space-y-4">
                {safeRequests.map(r => (
                  <div key={r.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <div className="font-semibold">{r.nome}</div>
                      <a href={r.urlProva} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm break-all">{r.urlProva}</a>
                      <div className="text-xs text-muted-foreground mt-1">
                        Richiesta da utente: {userMap[r.userId] ? (
                          <Link href={`/menu/profilo/${r.userId}`} className="text-blue-700 underline hover:text-blue-900 cursor-pointer">
                            {userMap[r.userId].nome} {userMap[r.userId].cognome}
                          </Link>
                        ) : (
                          r.userId
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 md:mt-0">
                      <Button size="sm" variant="outline" disabled={actionLoading === r.id+"accetta"} onClick={() => handleAction(r.id, "accetta")}>{actionLoading === r.id+"accetta" ? "..." : <><Check className="h-4 w-4 mr-1"/>Accetta</>}</Button>
                      <Button size="sm" variant="destructive" disabled={actionLoading === r.id+"rifiuta"} onClick={() => handleAction(r.id, "rifiuta")}>{actionLoading === r.id+"rifiuta" ? "..." : <><X className="h-4 w-4 mr-1"/>Rifiuta</>}</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 