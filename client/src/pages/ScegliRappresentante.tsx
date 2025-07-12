import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Check, User, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { PageTransition } from "@/components/PageTransition";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CustomAvatar } from "@/components/CustomAvatar";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";

interface Rappresentante {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  grado_elezione?: string;
  opinioni_comuni: number;
  avatar_config?: string;
  // Campi per le opinioni
  energia_nucleare?: string;
  sperimentazione_animale?: string;
  legalizzazione_canapa?: string;
  caccia?: string;
  unione_europea?: string;
  // Campi per la località
  paese_elezione?: string;
  regione_elezione?: string;
  provincia_elezione?: string;
  comune_elezione?: string;
}

export default function ScegliRappresentante() {
  const { categoria } = useParams<{ categoria: string }>();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const authReady = useAuthReady();
  const [rappresentanti, setRappresentanti] = useState<Rappresentante[]>([]);
  const [userOpinions, setUserOpinions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selezionando, setSelezionando] = useState(false);
  const [rappresentanteSelezionato, setRappresentanteSelezionato] = useState<string | null>(null);
  const [opinioniDialogOpen, setOpinioniDialogOpen] = useState(false);
  const [opinioniDialogData, setOpinioniDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string} | null>(null);
  
  // Titolo visualizzato in base alla categoria
  const getTitolo = (): string => {
    switch (categoria) {
      case "europeo": return "Europeo";
      case "camera": return "Nazionale";
      case "senato": return "Nazionale";
      case "regione": return "Regionale";
      case "comune": return "Comunale";
      default: return "Rappresentante";
    }
  };
  
  // Campo database in base alla categoria
  const getFieldName = (): string => {
    switch (categoria) {
      case "europeo": return "rappresentante_europeo";
      case "camera": return "rappresentante_camera";
      case "senato": return "rappresentante_senato";
      case "regione": return "rappresentante_regionale";
      case "comune": return "rappresentante_comunale";
      default: return "";
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Carica i dati dell'utente corrente direttamente da Firestore
        const userDocRef = doc(db, "utenti", user.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        
        console.log('Dati utente completi:', userData);
        
        // Recupera l'ID del rappresentante selezionato
        if (userData) {
          setRappresentanteSelezionato(userData[getFieldName()] || null);
        }
        
        // Carica le opinioni dell'utente corrente direttamente da Firestore
        const opinionsDocRef = doc(db, "opinioni", user.uid);
        const opinionsDoc = await getDoc(opinionsDocRef);
        const opinionsData = opinionsDoc.data() || {};
        setUserOpinions(opinionsData);
        
        // Carica tutti gli utenti con ruolo politico o politico candidato direttamente da Firestore
        const usersCollectionRef = collection(db, "utenti");
        const usersSnapshot = await getDocs(usersCollectionRef);
        const allUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const data = allUsers.filter((user: any) => 
          (user.ruolo === 'Politico' || user.ruolo === 'Candidato Politico') &&
          user.grado_elezione === getTitolo()
        );
        
        console.log(`Utenti trovati per grado ${getTitolo()}:`, data.length);
        console.log(`Email utente corrente: ${userData?.email}`);
        
        if (data) {
          // Filtra i rappresentanti in base alla località di elezione dell'utente corrente
          let filteredData = data;
          
          // Filtra in base alla località appropriata secondo il livello
          if (userData) {
            switch (categoria) {
              case "europeo":
                // Per rappresentanti europei, filtra per paese
                filteredData = data.filter((item: any) => 
                  !userData.paese_elezione || 
                  item.paese_elezione === userData.paese_elezione
                );
                break;
              case "camera":
              case "senato":
                // Per rappresentanti nazionali, filtra per paese
                filteredData = data.filter((item: any) => 
                  !userData.paese_elezione || 
                  item.paese_elezione === userData.paese_elezione
                );
                break;
              case "regione":
                // Per rappresentanti regionali, filtra per regione
                filteredData = data.filter((item: any) => 
                  !userData.regione_elezione || 
                  (item.paese_elezione === userData.paese_elezione && 
                  item.regione_elezione === userData.regione_elezione)
                );
                break;
              case "comune":
                // Per rappresentanti comunali, filtra per comune
                filteredData = data.filter((item: any) => 
                  !userData.comune_elezione || 
                  (item.paese_elezione === userData.paese_elezione && 
                  item.regione_elezione === userData.regione_elezione &&
                  item.provincia_elezione === userData.provincia_elezione &&
                  item.comune_elezione === userData.comune_elezione)
                );
                break;
              default:
                break;
            }
          }
          
          // Calcola le opinioni comuni con l'utente corrente
          const rappresentantiConOpinioniComuni = filteredData.map((rappresentante: any) => {
            let opinioniComuni = 0;
            
            // Confronta le opinioni, considerando anche stringhe vuote e valori non specificati
            const confrontaOpinione = (repOpinione: string, userOpinione: string) => {
              // Se entrambe sono definite e non vuote, confrontale
              if (repOpinione && userOpinione && repOpinione.trim() !== '' && userOpinione.trim() !== '') {
                return repOpinione === userOpinione;
              }
              // Se entrambe sono vuote o non definite, considerale uguali
              if ((!repOpinione || repOpinione.trim() === '') && (!userOpinione || userOpinione.trim() === '')) {
                return true;
              }
              return false;
            };
            
            if (confrontaOpinione(rappresentante.energia_nucleare, opinionsData.energia_nucleare)) {
              opinioniComuni++;
            }
            if (confrontaOpinione(rappresentante.sperimentazione_animale, opinionsData.sperimentazione_animale)) {
              opinioniComuni++;
            }
            if (confrontaOpinione(rappresentante.legalizzazione_canapa, opinionsData.legalizzazione_canapa)) {
              opinioniComuni++;
            }
            if (confrontaOpinione(rappresentante.caccia, opinionsData.caccia)) {
              opinioniComuni++;
            }
            if (confrontaOpinione(rappresentante.unione_europea, opinionsData.unione_europea)) {
              opinioniComuni++;
            }
            
            return {
              ...rappresentante,
              opinioni_comuni: opinioniComuni
            };
          });
          setRappresentanti(rappresentantiConOpinioniComuni);
        }
        setLoading(false);
      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i rappresentanti.",
          variant: "destructive",
        });
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user, categoria, toast]);

  const selezionaRappresentante = async (rappresentanteId: string) => {
    if (!user) return;
    
    setSelezionando(true);
    try {
      // Aggiorna direttamente in Firestore
      const userDocRef = doc(db, "utenti", user.uid);
      const updateData: Record<string, string> = {
        [getFieldName()]: rappresentanteId
      };
      
      await updateDoc(userDocRef, updateData);
      
      setRappresentanteSelezionato(rappresentanteId);
      toast({
        title: "Successo",
        description: "Rappresentante selezionato con successo!",
      });
    } catch (error) {
      console.error("Errore durante la selezione:", error);
      toast({
        title: "Errore",
        description: "Impossibile selezionare il rappresentante.",
        variant: "destructive",
      });
    } finally {
      setSelezionando(false);
    }
  };

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

  // Funzione per visualizzare le opinioni del rappresentante
  const renderOpinioni = (rappresentante: Rappresentante) => {
    const opinioniItems = [
      { key: "energia_nucleare", label: "Energia Nucleare" },
      { key: "sperimentazione_animale", label: "Sperimentazione Animale" },
      { key: "legalizzazione_canapa", label: "Legalizzazione Canapa" },
      { key: "caccia", label: "Caccia" },
      { key: "unione_europea", label: "Unione Europea" }
    ];
    
    return (
      <div className="mt-4 space-y-2">
        <h4 className="font-medium text-sm">Opinioni:</h4>
        <div className="space-y-1 text-sm">
          {opinioniItems.map(item => {
            const keyTyped = item.key as keyof Rappresentante;
            const opinione = rappresentante[keyTyped] as string;
            const userOpinione = userOpinions?.[item.key];
            const isCommon = opinione && userOpinione && opinione === userOpinione;
            
            return (
              <div key={item.key} className="flex items-center">
                <span className="w-40">{item.label}:</span>
                <span className={isCommon ? "font-medium text-green-600" : ""}>
                  {opinione || "Non specificata"}
                  {isCommon && <ThumbsUp className="inline-block ml-1 h-3 w-3" />}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col mb-6">
          <div className="flex items-center mb-2">
            <Button variant="ghost" className="mr-2" asChild>
              <Link to="/rappresentanti">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Scegli Rappresentante {getTitolo()}</h1>
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
        
        {rappresentanti.length === 0 ? (
          <Card className="w-full max-w-3xl mx-auto mb-6">
            <CardHeader>
              <CardTitle className="text-center">Nessun rappresentante disponibile</CardTitle>
              <CardDescription className="text-center">
                Non ci sono rappresentanti {getTitolo().toLowerCase()} disponibili al momento.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rappresentanti.map((rappresentante) => (
              <Card key={rappresentante.id} className="w-full">
                <CardHeader>
                  <div className="flex justify-center mb-2">
                    {(() => {
                      try {
                        if (rappresentante.avatar_config) {
                          const config = JSON.parse(rappresentante.avatar_config);
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
                              size={64}
                              className="border-2 border-gray-200 rounded-full shadow-sm"
                            />
                          );
                        }
                      } catch (error) {
                        console.error("Errore nel parsing della configurazione avatar:", error);
                      }
                      return (
                        <Avatar className="h-16 w-16">
                          <AvatarFallback>{rappresentante.nome.charAt(0)}{rappresentante.cognome.charAt(0)}</AvatarFallback>
                        </Avatar>
                      );
                    })()}
                  </div>
                  <CardTitle className="text-xl text-center cursor-pointer hover:underline" onClick={() => setOpinioniDialogData({ utenteId: rappresentante.id, nome: rappresentante.nome, cognome: rappresentante.cognome, avatarConfig: rappresentante.avatar_config })}>
                    {rappresentante.nome} {rappresentante.cognome}
                  </CardTitle>
                  <Button variant="secondary" size="sm" className="mx-auto mt-1" onClick={() => setOpinioniDialogData({ utenteId: rappresentante.id, nome: rappresentante.nome, cognome: rappresentante.cognome, avatarConfig: rappresentante.avatar_config })}>
                    Vedi Opinioni
                  </Button>
                  <div className="flex justify-center space-x-2 mt-2">
                    <Badge variant="outline">{rappresentante.ruolo}</Badge>
                    <Badge variant="secondary">
                      {rappresentante.opinioni_comuni} opinioni comuni
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Opinioni rimosse: ora visibili solo nel modale */}
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    onClick={() => selezionaRappresentante(rappresentante.id)}
                    disabled={selezionando}
                  >
                    {selezionando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Scegli
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}