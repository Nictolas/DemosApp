import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageTransition } from "@/components/PageTransition";

export default function Rappresentanti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const response = await apiRequest("GET", `/api/user`);
          const data = await response.json();
          setUserData(data);
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

  // Definizione delle categorie dei rappresentanti
  const categorie = [
    { id: "europeo", nome: "Europeo", field: "rappresentante_europeo" },
    { id: "camera", nome: "Camera", field: "rappresentante_camera" },
    { id: "senato", nome: "Senato", field: "rappresentante_senato" },
    { id: "regione", nome: "Regione", field: "rappresentante_regione" },
    { id: "comune", nome: "Comune", field: "rappresentante_comune" }
  ];

  // Funzione per mostrare i dettagli del rappresentante o un pulsante per sceglierlo
  const renderRappresentante = (categoria: { id: string, nome: string, field: string }) => {
    const rappresentanteId = userData?.[categoria.field];
    
    if (rappresentanteId) {
      return (
        <div className="flex flex-col space-y-2 items-center">
          <User className="h-12 w-12 text-primary" />
          <p className="text-sm text-gray-500">ID: {rappresentanteId}</p>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => window.location.href = `/scegli-rappresentante/${categoria.id}`}
          >
            Cambia rappresentante
          </Button>
        </div>
      );
    }
    
    return (
      <Button 
        variant="default"
        onClick={() => window.location.href = `/scegli-rappresentante/${categoria.id}`}
      >
        Scegli Rappresentante
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
          <h1 className="text-2xl font-bold">I tuoi Rappresentanti</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categorie.map((categoria) => (
            <Card key={categoria.id} className="w-full">
              <CardHeader>
                <CardTitle className="text-xl text-center">{categoria.nome}</CardTitle>
                <CardDescription className="text-center">
                  Il tuo rappresentante {categoria.nome.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-4">
                {renderRappresentante(categoria)}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}