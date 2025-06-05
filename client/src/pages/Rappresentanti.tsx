import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/CustomAvatar";
import { db, auth } from "@/lib/firebase";

export default function Rappresentanti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rappresentanti, setRappresentanti] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          // Carica i dati dell'utente
          const response = await apiRequest("GET", `/api/user`);
          const data = await response.json();
          setUserData(data);
          
          // Caricare i dettagli dei rappresentanti
          await fetchRappresentanti(data);
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
    
    // Funzione per caricare i dettagli dei rappresentanti
    const fetchRappresentanti = async (userData: any) => {
      if (!userData) return;
      
      const rappresentantiData: Record<string, any> = {};
      const categorie = [
        { id: "europeo", field: "rappresentante_europeo" },
        { id: "camera", field: "rappresentante_camera" },
        { id: "senato", field: "rappresentante_senato" },
        { id: "regione", field: "rappresentante_regione" },
        { id: "comune", field: "rappresentante_comune" }
      ];
      
      for (const categoria of categorie) {
        const rappresentanteId = userData[categoria.field];
        if (rappresentanteId) {
          try {
            // Caricare i dettagli del rappresentante tramite API
            const response = await fetch(`/api/users/${encodeURIComponent(rappresentanteId)}`);
            if (response.ok) {
              const data = await response.json();
              rappresentantiData[categoria.id] = data;
            } else {
              console.error(`Errore nel caricare il rappresentante ${categoria.id}:`, response.statusText);
            }
          } catch (error) {
            console.error(`Errore nel caricare il rappresentante ${categoria.id}:`, error);
          }
        }
      }
      
      setRappresentanti(rappresentantiData);
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
    const rappresentanteData = rappresentanti[categoria.id];
    
    if (rappresentanteId) {
      return (
        <div className="flex flex-col space-y-3 items-center">
          {/* Avatar del rappresentante */}
          {(() => {
            if (rappresentanteData?.avatar_config) {
              try {
                const config = JSON.parse(rappresentanteData.avatar_config);
                // Converti le configurazioni legacy
                const updatedConfig = {
                  skinColor: config.skinColor || "#FDBCB4",
                  hairColor: config.hairColor || "#8B4513",
                  hairStyle: config.hairStyle || "short",
                  mustacheStyle: config.mustacheStyle || (config.mustache ? "classic" : "none"),
                  mustacheColor: config.mustacheColor || "#2C1810",
                  beardStyle: config.beardStyle || "none",
                  beardColor: config.beardColor || "#2C1810",
                  noseStyle: config.noseStyle || "normal",
                  suitColor: config.suitColor || "#2C3E50",
                  tieColor: config.tieColor || "#E74C3C"
                };
                return (
                  <CustomAvatar 
                    config={updatedConfig}
                    size={80}
                    className="border-2 border-gray-300 rounded-full shadow-sm"
                  />
                );
              } catch (error) {
                console.error("Errore nel parsing della configurazione avatar:", error);
              }
            }
            return <User className="h-20 w-20 text-primary p-4 border-2 border-gray-300 rounded-full" />;
          })()}
          
          <div className="text-center">
            <p className="font-medium text-primary">
              {rappresentanteData ? `${rappresentanteData.nome} ${rappresentanteData.cognome}` : 'Caricamento...'}
            </p>
          </div>
          
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