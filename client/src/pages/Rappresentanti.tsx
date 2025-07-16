import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/CustomAvatar";
import { db, auth } from "@/lib/firebase";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { collection, doc, getDoc } from "firebase/firestore";

export default function Rappresentanti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const authReady = useAuthReady();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rappresentanti, setRappresentanti] = useState<Record<string, any>>({});
  const [opinioniDialogOpen, setOpinioniDialogOpen] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string} | null>(null);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          // Carica i dati completi dell'utente direttamente da Firestore
          const userDocRef = doc(db, "utenti", user.uid);
          const userDoc = await getDoc(userDocRef);
          const completeUserData = userDoc.data();
          
          console.log("DEBUG: Dati utente completi caricati:", completeUserData);
          console.log("DEBUG: User UID:", user.uid);
          setUserData(completeUserData);
          
          // Carica i dettagli dei rappresentanti
          await fetchRappresentanti(completeUserData);
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
      if (!userData) {
        console.log("DEBUG: userData è null/undefined, non posso caricare i rappresentanti");
        return;
      }
      
      const rappresentantiData: Record<string, any> = {};
      const categorie = [
        { id: "europeo", field: "rappresentante_europeo" },
        { id: "camera", field: "rappresentante_camera" },
        { id: "senato", field: "rappresentante_senato" },
        { id: "regione", field: "rappresentante_regionale" },
        { id: "comune", field: "rappresentante_comunale" }
      ];
      
      for (const categoria of categorie) {
        const rappresentanteId = userData[categoria.field];
        console.log(`DEBUG: Categoria ${categoria.id} - campo ${categoria.field} =`, rappresentanteId);
        if (rappresentanteId) {
          try {
            // Carica i dettagli del rappresentante direttamente da Firestore
            const rappresentanteDocRef = doc(db, "utenti", rappresentanteId);
            const rappresentanteDoc = await getDoc(rappresentanteDocRef);
            if (rappresentanteDoc.exists()) {
              rappresentantiData[categoria.id] = rappresentanteDoc.data();
              console.log(`DEBUG: Dati caricati per ${categoria.id}:`, rappresentanteDoc.data());
            } else {
              console.log(`DEBUG: Rappresentante ${categoria.id} non trovato in Firestore`);
            }
          } catch (error) {
            console.error(`Errore nel caricare il rappresentante ${categoria.id}:`, error);
          }
        } else {
          console.log(`DEBUG: Nessun rappresentante per categoria ${categoria.id}`);
        }
      }
      
      console.log("DEBUG: Rappresentanti caricati:", rappresentantiData);
      setRappresentanti(rappresentantiData);
    };
    
    fetchUserData();
  }, [user, toast]);

  // Log di debug per il rendering
  console.log('DEBUG: Stato del componente - loading:', loading);
  console.log('DEBUG: Stato del componente - userData:', !!userData);
  console.log('DEBUG: Stato del componente - rappresentanti:', Object.keys(rappresentanti).length);
  console.log('DEBUG: Stato del componente - authReady:', authReady);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  if (!authReady) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback per dati mancanti
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallback per userData mancante
  if (!userData) {
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
          
          <Card className="p-8 text-center">
            <CardContent>
              <h2 className="text-xl font-semibold mb-4">Dati utente non trovati</h2>
              <p className="text-muted-foreground mb-4">
                Impossibile caricare i tuoi dati. Riprova più tardi.
              </p>
              <Button asChild>
                <Link to="/menu">Torna al Menu</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  // Definizione delle categorie dei rappresentanti
  const categorie = [
    { id: "europeo", nome: "Parlamento Europeo", field: "rappresentante_europeo", color: "blue" },
    { id: "camera", nome: "Camera dei Deputati", field: "rappresentante_camera", color: "green" },
    { id: "senato", nome: "Senato della Repubblica", field: "rappresentante_senato", color: "purple" },
    { id: "regione", nome: "Consiglio Regionale", field: "rappresentante_regionale", color: "orange" },
    { id: "comune", nome: "Consiglio Comunale", field: "rappresentante_comunale", color: "teal" }
  ];

  // Funzione per mostrare i dettagli del rappresentante o un pulsante per sceglierlo
  const renderRappresentante = (categoria: { id: string, nome: string, field: string, color: string }) => {
    const rappresentanteId = userData?.[categoria.field];
    const rappresentanteData = rappresentanti[categoria.id];
    
    return (
      <div className="flex flex-col space-y-3 items-center">
        {/* Avatar del rappresentante */}
        {(() => {
          if (rappresentanteId && rappresentanteData?.avatar_config) {
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
          // Avatar vuoto per rappresentanti assenti
          return (
            <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-10 w-10 text-gray-400" />
            </div>
          );
        })()}
        
        <div className="text-center">
          {rappresentanteId && rappresentanteData ? (
            <>
              <p className="font-medium text-primary cursor-pointer hover:underline" onClick={() => setOpinioniDialogData({ utenteId: rappresentanteId, nome: rappresentanteData.nome, cognome: rappresentanteData.cognome, avatarConfig: rappresentanteData.avatar_config })}>
                {`${rappresentanteData.nome} ${rappresentanteData.cognome}`}
              </p>
              <Button variant="secondary" size="sm" className="mt-1" onClick={() => setOpinioniDialogData({ utenteId: rappresentanteId, nome: rappresentanteData.nome, cognome: rappresentanteData.cognome, avatarConfig: rappresentanteData.avatar_config })}>
                Vedi Opinioni
              </Button>
            </>
          ) : (
            <p className="text-gray-500 italic">Assente</p>
          )}
        </div>
        
        <Button 
          variant={rappresentanteId ? "outline" : "default"}
          size="sm"
          onClick={() => window.location.href = `/scegli-rappresentante/${categoria.id}`}
        >
          {rappresentanteId ? "Cambia rappresentante" : "Scegli Rappresentante"}
        </Button>
      </div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorie.map((categoria) => {
            const colorClasses = {
              blue: "bg-blue-50 border-blue-200",
              green: "bg-green-50 border-green-200", 
              purple: "bg-purple-50 border-purple-200",
              orange: "bg-orange-50 border-orange-200",
              teal: "bg-teal-50 border-teal-200"
            };
            
            const titleColorClasses = {
              blue: "text-blue-800",
              green: "text-green-800",
              purple: "text-purple-800", 
              orange: "text-orange-800",
              teal: "text-teal-800"
            };
            
            return (
              <Card key={categoria.id} className={`w-full ${colorClasses[categoria.color as keyof typeof colorClasses]}`}>
                <CardHeader>
                  <CardTitle className={`text-lg text-center ${titleColorClasses[categoria.color as keyof typeof titleColorClasses]}`}>
                    {categoria.nome}
                  </CardTitle>
                  <CardDescription className="text-center">
                    Il tuo rappresentante attuale
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-4">
                  {renderRappresentante(categoria)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <ViewOpinioniDialog
        open={!!opinioniDialogData}
        onOpenChange={(open) => { if (!open) setOpinioniDialogOpen(false); setOpinioniDialogData(null); }}
        utenteId={opinioniDialogData?.utenteId || ''}
        nome={opinioniDialogData?.nome}
        cognome={opinioniDialogData?.cognome}
        avatarConfig={opinioniDialogData?.avatarConfig}
      />
    </PageTransition>
  );
}