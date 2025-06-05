import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/CustomAvatar";
import { db, auth } from "@/lib/firebase";

export default function Elezioni() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [candidati, setCandidati] = useState<Record<string, any>>({});
  const [elezioni, setElezioni] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          // Carica i dati base dell'utente per ottenere l'email
          const userResponse = await apiRequest("GET", `/api/user`);
          const userData = await userResponse.json();
          
          // Carica i dati completi dell'utente tramite email
          const completeUserResponse = await fetch(`/api/users/${encodeURIComponent(userData.email)}`);
          const completeUserData = await completeUserResponse.json();
          
          console.log("Dati utente completi caricati:", completeUserData);
          setUserData(completeUserData);
          
          // Carichiamo i dati delle elezioni
          try {
            const elezioniResponse = await fetch('/api/elezioni');
            if (elezioniResponse.ok) {
              const elezioniData = await elezioniResponse.json();
              setElezioni(elezioniData);
            }
          } catch (err) {
            console.error("Errore durante il recupero dei dati delle elezioni:", err);
          }

          // Carichiamo i dati di tutti i candidati che l'utente ha selezionato
          const candidatiIds = [
            completeUserData.candidato_europeo, 
            completeUserData.candidato_camera, 
            completeUserData.candidato_senato, 
            completeUserData.candidato_regionale, 
            completeUserData.candidato_comunale
          ].filter(Boolean); // Filtriamo i valori nulli o undefined
          
          if (candidatiIds.length > 0) {
            try {
              // Recuperiamo i dati dei candidati tramite API
              const response = await fetch('/api/candidati');
              if (!response.ok) {
                throw new Error('Errore nel caricamento candidati');
              }
              
              const candidatiData = await response.json();
              
              // Filtriamo solo i candidati che ci interessano
              const candidatiRelevanti = candidatiData.filter((c: any) => candidatiIds.includes(c.id));
              
              // Convertiamo l'array in un oggetto con l'ID come chiave per accesso rapido
              const candidatiMap = candidatiRelevanti.reduce((acc: Record<string, any>, candidato: any) => {
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
    { id: "europeo", nome: "Parlamento Europeo", field: "candidato_europeo", color: "blue", tipoElezione: "sovranazione" },
    { id: "camera", nome: "Camera dei Deputati", field: "candidato_camera", color: "green", tipoElezione: "stato" },
    { id: "senato", nome: "Senato della Repubblica", field: "candidato_senato", color: "purple", tipoElezione: "stato" },
    { id: "regione", nome: "Consiglio Regionale", field: "candidato_regionale", color: "orange", tipoElezione: "regione" },
    { id: "comune", nome: "Consiglio Comunale", field: "candidato_comunale", color: "teal", tipoElezione: "comune" }
  ];

  // Funzione per trovare l'elezione più rilevante per una categoria
  const getElectionForCategory = (categoria: { tipoElezione: string }) => {
    return elezioni.find(elezione => elezione.tipo === categoria.tipoElezione);
  };

  // Funzione per formattare le date delle elezioni
  const formatElectionDates = (elezione: any) => {
    if (!elezione) return null;
    
    if (elezione.circa) {
      // Se è approssimativa, mostra solo gli anni
      if (elezione.dataInizio === elezione.dataFine) {
        return `${elezione.dataInizio}`;
      }
      return `${elezione.dataInizio} - ${elezione.dataFine}`;
    } else {
      // Se non è approssimativa, formatta le date complete
      const formatDate = (dateString: string) => {
        try {
          return new Date(dateString).toLocaleDateString('it-IT');
        } catch {
          return dateString;
        }
      };
      
      const dataInizio = formatDate(elezione.dataInizio);
      const dataFine = formatDate(elezione.dataFine);
      
      if (dataInizio === dataFine) {
        return dataInizio;
      }
      return `${dataInizio} - ${dataFine}`;
    }
  };

  // Funzione per mostrare i dettagli del candidato o un pulsante per sceglierlo
  const renderCandidato = (categoria: { id: string, nome: string, field: string, color: string }) => {
    const candidatoId = userData?.[categoria.field];
    
    if (candidatoId) {
      const candidato = candidati[candidatoId];
      
      return (
        <div className="flex flex-col space-y-3 items-center">
          {/* Avatar del candidato */}
          {(() => {
            if (candidato?.avatar_config) {
              try {
                const config = JSON.parse(candidato.avatar_config);
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
            // Avatar vuoto per candidati senza avatar
            return (
              <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="h-10 w-10 text-gray-400" />
              </div>
            );
          })()}
          
          <div className="text-center">
            {candidato ? (
              <p className="font-medium text-primary">
                {`${candidato.nome} ${candidato.cognome}`}
              </p>
            ) : (
              <p className="text-gray-500 italic">Caricamento...</p>
            )}
          </div>
          
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
      <div className="flex flex-col space-y-3 items-center">
        {/* Avatar vuoto per candidati assenti */}
        <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="h-10 w-10 text-gray-400" />
        </div>
        
        <div className="text-center">
          <p className="text-gray-500 italic">Assente</p>
        </div>
        
        <Button 
          variant="default"
          size="sm"
          onClick={() => window.location.href = `/scegli-candidato/${categoria.id}`}
        >
          Scegli Candidato
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
          <h1 className="text-2xl font-bold">Le tue Elezioni</h1>
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
            
            const elezione = getElectionForCategory(categoria);
            const dateString = formatElectionDates(elezione);
            
            return (
              <Card key={categoria.id} className={`w-full ${colorClasses[categoria.color as keyof typeof colorClasses]}`}>
                <CardHeader>
                  <CardTitle className={`text-lg text-center ${titleColorClasses[categoria.color as keyof typeof titleColorClasses]}`}>
                    {categoria.nome}
                  </CardTitle>
                  {dateString && (
                    <div className="text-center text-sm text-gray-600 mt-2 mb-1">
                      <span className="font-medium">Prossime elezioni:</span>
                      <br />
                      <span className="text-gray-800">{dateString}</span>
                    </div>
                  )}
                  <CardDescription className="text-center">
                    Il tuo candidato attuale
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-4">
                  {renderCandidato(categoria)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}