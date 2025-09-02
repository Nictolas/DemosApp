import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";

import { Loader2, ArrowLeft, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
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
      <div className="min-h-screen flex flex-col overflow-hidden page-with-navbar">
        <div className="container mx-auto px-4 py-8">
          <Link href="/menu">
            <Button variant="ghost" className="mb-4 flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu
            </Button>
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Le tue Elezioni</h1>
            <p className="text-gray-600">Gestisci i tuoi candidati per le diverse elezioni</p>
          </div>

          {/* Card principale - Parlamento Europeo */}
          <div className="relative w-full rounded-2xl shadow-lg overflow-hidden mb-4 cursor-pointer">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" />
              <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
            </svg>
            <div className="relative z-10 p-6 flex flex-col items-center justify-center">
              <User className="h-12 w-12 text-blue-600 mb-2" />
              <div className="text-2xl font-bold text-blue-800 mb-1">{categorie[0].nome}</div>
              {(() => {
                const elezione = getElectionForCategory(categorie[0]);
                const dateString = formatElectionDates(elezione);
                return dateString ? (
                  <p className="text-blue-600 text-center mb-2">
                    <span className="font-medium">Prossime elezioni:</span><br />
                    <span>{dateString}</span>
                  </p>
                ) : null;
              })()}
              <p className="text-blue-600 text-center mb-4">Il tuo candidato attuale</p>
              {renderCandidato(categorie[0])}
            </div>
          </div>
          
          {/* Altre card in griglia 2x2 */}
          <div className="grid grid-cols-2 gap-4 pb-2">
            {categorie.slice(1).map((categoria) => {
              const colorMap = { 
                green: { bg: "#bbf7d0", text: "#166534", icon: "#16a34a" }, 
                purple: { bg: "#ede9fe", text: "#581c87", icon: "#9333ea" }, 
                orange: { bg: "#fef9c3", text: "#92400e", icon: "#ea580c" },
                teal: { bg: "#a7f3d0", text: "#134e4a", icon: "#0d9488" }
              };
              const color = colorMap[categoria.color as keyof typeof colorMap];
              const elezione = getElectionForCategory(categoria);
              const dateString = formatElectionDates(elezione);
              
              return (
                <div key={categoria.id} className="relative w-full rounded-2xl shadow-lg overflow-hidden">
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
                    <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
                  </svg>
                  <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center">
                    <User className="h-8 md:h-12 w-8 md:w-12 mb-2" style={{ color: color.icon }} />
                    <div className="text-base md:text-xl font-bold mb-1 text-center leading-tight" style={{ color: color.text }}>
                      {categoria.nome}
                    </div>
                    {dateString && (
                      <p className="text-sm text-center mb-2" style={{ color: color.text }}>
                        <span className="font-medium">Prossime elezioni:</span><br />
                        <span>{dateString}</span>
                      </p>
                    )}
                    <p className="text-sm text-center mb-3" style={{ color: color.text }}>
                      Il tuo candidato attuale
                    </p>
                    {renderCandidato(categoria)}
                  </div>
                </div>
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
      </div>
    </PageTransition>
  );
}