import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { supabase } from "@/lib/supabase";

export default function Elezioni() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [candidati, setCandidati] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const response = await apiRequest("GET", `/api/user`);
          const data = await response.json();
          setUserData(data);
          
          // Carichiamo i dati di tutti i candidati che l'utente ha selezionato
          const candidatiIds = [
            data.candidato_europeo, 
            data.candidato_camera, 
            data.candidato_senato, 
            data.candidato_regione, 
            data.candidato_comune
          ].filter(Boolean); // Filtriamo i valori nulli o undefined
          
          if (candidatiIds.length > 0) {
            try {
              // Recuperiamo i dati dei candidati in un'unica query
              const { data: candidatiData, error } = await supabase
                .from('utenti')
                .select('id, nome, cognome, ruolo')
                .in('id', candidatiIds);
                
              if (error) {
                throw new Error(error.message);
              }
              
              // Convertiamo l'array in un oggetto con l'ID come chiave per accesso rapido
              const candidatiMap = candidatiData.reduce((acc: Record<string, any>, candidato) => {
                acc[candidato.id] = candidato;
                return acc;
              }, {});
              
              setCandidati(candidatiMap);
            } catch (err) {
              console.error("Errore durante il recupero dei dati dei candidati:", err);
            }
          }
        } catch (error) {
          console.error("Errore durante il recupero dei dati utente:", error);
          toast({
            title: "Errore",
            description: "Impossibile caricare i dati utente.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchUserData();
  }, [user, toast]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (isLoading || loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Definizione delle categorie di elezioni
  const categorie = [
    { id: "europeo", nome: "Europeo", field: "candidato_europeo" },
    { id: "camera", nome: "Camera", field: "candidato_camera" },
    { id: "senato", nome: "Senato", field: "candidato_senato" },
    { id: "regione", nome: "Regione", field: "candidato_regione" },
    { id: "comune", nome: "Comune", field: "candidato_comune" }
  ];

  // Funzione per mostrare i dettagli del candidato o un pulsante per sceglierlo
  const renderCandidato = (categoria: { id: string, nome: string, field: string }) => {
    const candidatoId = userData?.[categoria.field];
    
    if (candidatoId) {
      const candidato = candidati[candidatoId];
      return (
        <div className="flex flex-col space-y-2 items-center">
          <User className="h-12 w-12 text-primary" />
          {candidato ? (
            <div className="text-center">
              <p className="text-base font-medium">{candidato.nome} {candidato.cognome}</p>
              <p className="text-xs text-muted-foreground">{candidato.ruolo}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">ID: {candidatoId}</p>
          )}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `/scegli-candidato/${categoria.id}`}
          >
            Cambia candidato
          </Button>
        </div>
      );
    }
    
    return (
      <Button 
        variant="default"
        onClick={() => window.location.href = `/scegli-candidato/${categoria.id}`}
      >
        Scegli Candidato
      </Button>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" asChild>
            <Link to="/menu">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Le tue Elezioni</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categorie.map((categoria) => (
            <Card key={categoria.id} className="w-full">
              <CardHeader>
                <CardTitle className="text-xl text-center">{categoria.nome}</CardTitle>
                <CardDescription className="text-center">
                  Il tuo candidato {categoria.nome.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                {renderCandidato(categoria)}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}