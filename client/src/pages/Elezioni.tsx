import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/CustomAvatar";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { ViewProgrammaDialog } from "@/components/ViewProgrammaDialog";
// === AGGIUNTO ===
import { apiRequest } from "@/lib/queryClient";

// L'interfaccia rimane la stessa
interface Candidato {
  nome: string;
  cognome: string;
  avatar_config?: string;
}

export default function Elezioni() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [elezioni, setElezioni] = useState<any[]>([]);
  const [opinioniDialogData, setOpinioniDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string} | null>(null);
  const [programmaDialogData, setProgrammaDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string} | null>(null);
  const [candidatiDettagliati, setCandidatiDettagliati] = useState<Record<string, Candidato>>({});
  
  // === INIZIO MODIFICHE PRINCIPALI ===
  useEffect(() => {
    const fetchPageData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // 1. Usiamo un singolo endpoint API che restituisce tutti i dati necessari per questa pagina
        const response = await apiRequest("GET", `/api/elezioni-utente`);

        if (!response.ok) {
          throw new Error("Errore nel caricamento dei dati delle elezioni.");
        }

        const { utente, elezioni, candidati } = await response.json();
        
        // 2. Impostiamo i dati ricevuti dal backend
        setUserData(utente);
        setElezioni(elezioni);
        setCandidatiDettagliati(candidati);

      } catch (error) {
        console.error("Errore durante il recupero dei dati:", error);
        toast({
          title: "Errore",
          description: "Impossibile caricare i dati delle elezioni.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchPageData();
  }, [user, toast]);
  // === FINE MODIFICHE PRINCIPALI ===

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

  const categorie = [
    { id: "europeo", nome: "Parlamento Europeo", field: "candidato_europeo", color: "blue", tipoElezione: "sovranazione" },
    { id: "camera", nome: "Camera dei Deputati", field: "candidato_camera", color: "green", tipoElezione: "stato" },
    { id: "senato", nome: "Senato della Repubblica", field: "candidato_senato", color: "purple", tipoElezione: "stato" },
    { id: "regione", nome: "Consiglio Regionale", field: "candidato_regione", color: "orange", tipoElezione: "regione" },
    { id: "comune", nome: "Consiglio Comunale", field: "candidato_comune", color: "teal", tipoElezione: "comune" }
  ];

  const getElectionForCategory = (categoria: { tipoElezione: string }) => {
    return elezioni.find(elezione => elezione.tipo === categoria.tipoElezione);
  };

  const formatElectionDates = (elezione: any) => {
    if (!elezione) return null;
    if (elezione.circa) return elezione.dataInizio === elezione.dataFine ? `${elezione.dataInizio}` : `${elezione.dataInizio} - ${elezione.dataFine}`;
    
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('it-IT');
    const dataInizio = formatDate(elezione.dataInizio);
    const dataFine = formatDate(elezione.dataFine);
    
    return dataInizio === dataFine ? dataInizio : `${dataInizio} - ${dataFine}`;
  };

  const renderCandidato = (categoria: { id: string, nome: string, field: string, color: string }) => {
    const candidatoId = userData?.[categoria.field];
    
    if (candidatoId && candidatiDettagliati[candidatoId]) {
      const candidato = candidatiDettagliati[candidatoId];
      let avatarContent;
      try {
        if (candidato.avatar_config) {
          const config = JSON.parse(candidato.avatar_config);
          avatarContent = <CustomAvatar config={config} size={80} className="border-2 border-gray-300 rounded-full shadow-sm" />;
        }
      } catch (e) { /* Fallback will be used */ }

      return (
        <div className="flex flex-col space-y-3 items-center">
          {avatarContent || (
            <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="h-10 w-10 text-gray-400" />
            </div>
          )}
          <div className="text-center">
            <p className="font-medium text-primary cursor-pointer hover:underline" onClick={() => setOpinioniDialogData({ utenteId: candidatoId, nome: candidato.nome, cognome: candidato.cognome, avatarConfig: candidato.avatar_config })}>
              {`${candidato.nome} ${candidato.cognome}`}
            </p>
            <div className="flex flex-row gap-2 justify-center mt-1">
              <Button variant="secondary" size="sm" onClick={() => setOpinioniDialogData({ utenteId: candidatoId, nome: candidato.nome, cognome: candidato.cognome, avatarConfig: candidato.avatar_config })}>Vedi Opinioni</Button>
              <Button variant="outline" size="sm" onClick={() => setProgrammaDialogData({ utenteId: candidatoId, nome: candidato.nome, cognome: candidato.cognome, avatarConfig: candidato.avatar_config })}>Vedi Programma</Button>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/scegli-candidato/${categoria.id}`}>Cambia candidato</Link>
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col space-y-3 items-center">
        <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="h-10 w-10 text-gray-400" />
        </div>
        <p className="text-gray-500 italic">Nessun candidato scelto</p>
        <Button variant="default" size="sm" asChild>
          <Link to={`/scegli-candidato/${categoria.id}`}>Scegli Candidato</Link>
        </Button>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Button variant="ghost" className="mr-2" asChild>
            <Link to="/menu"><ArrowLeft className="h-4 w-4 mr-2" />Indietro</Link>
          </Button>
          <h1 className="text-2xl font-bold">Le tue Elezioni</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categorie.map((categoria) => {
            const colorClasses = `bg-${categoria.color}-50 border-${categoria.color}-200`;
            const titleColorClasses = `text-${categoria.color}-800`;
            const elezione = getElectionForCategory(categoria);
            const dateString = formatElectionDates(elezione);
            
            return (
              <Card key={categoria.id} className={`w-full ${colorClasses}`}>
                <CardHeader>
                  <CardTitle className={`text-lg text-center ${titleColorClasses}`}>{categoria.nome}</CardTitle>
                  {dateString && (
                    <div className="text-center text-sm text-gray-600 mt-2 mb-1">
                      <span className="font-medium">Prossime elezioni:</span><br />
                      <span className="text-gray-800">{dateString}</span>
                    </div>
                  )}
                  <CardDescription className="text-center">Il tuo candidato attuale</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center py-4">{renderCandidato(categoria)}</CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <ViewOpinioniDialog
        open={!!opinioniDialogData}
        onOpenChange={(open) => !open && setOpinioniDialogData(null)}
        utenteId={opinioniDialogData?.utenteId || ''}
        nome={opinioniDialogData?.nome}
        cognome={opinioniDialogData?.cognome}
        avatarConfig={opinioniDialogData?.avatarConfig}
      />
      <ViewProgrammaDialog
        open={!!programmaDialogData}
        onOpenChange={(open) => !open && setProgrammaDialogData(null)}
        utenteId={programmaDialogData?.utenteId || ''}
        nome={programmaDialogData?.nome}
        cognome={programmaDialogData?.cognome}
        avatarConfig={programmaDialogData?.avatarConfig}
      />
    </PageTransition>
  );
}