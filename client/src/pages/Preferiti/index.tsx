import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, useLocation } from "wouter";
import { Heart, Users, Star, UserCheck, Building2, MessageSquare, Vote } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card } from "@/components/ui/card";
import { OpinioniIncompleteAlert } from "@/pages/ScegliRappresentante/components/OpinioniIncompleteAlert";
import { apiRequest } from "@/lib/queryClient";

interface PreferitiButtonProps {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  color: {
    bg: string;
    icon: string;
  };
  onNavigate: (path: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

const PreferitiButton: React.FC<PreferitiButtonProps> = ({
  path,
  icon: Icon,
  label,
  color,
  onNavigate
}) => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    onNavigate(path, e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('scale-95', 'shadow-md');
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('scale-95', 'shadow-md');
    onNavigate(path, e as any);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className="menu-button relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      data-testid="preferiti-button"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={color.bg} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-12 h-12 mb-2">
          <Icon className="h-10 w-10 text-white absolute" style={{ filter: 'drop-shadow(0 0 0 #fff)' }} />
          <Icon className="h-8 w-8 relative z-10" style={{ color: color.icon }} />
        </span>
        <div className={`text-gray-700 font-semibold select-none ${label === 'Organizzazioni' ? 'text-lg' : 'text-xl'}`}>{label}</div>
      </div>
    </button>
  );
};

const preferitiItems = [
  {
    id: "politici",
    path: "/rappresentanti",
    icon: Users,
    label: "Politici",
    color: {
      bg: "#dbeafe",
      icon: "#2563eb"
    }
  },
  {
    id: "candidati",
    path: "/candidati",
    icon: Star,
    label: "Candidati",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "attivisti",
    path: "/attivisti",
    icon: UserCheck,
    label: "Attivisti",
    color: {
      bg: "#dcfce7",
      icon: "#16a34a"
    }
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    icon: Building2,
    label: "Organizzazioni",
    color: {
      bg: "#f3e8ff",
      icon: "#9333ea"
    }
  }
];

export default function Preferiti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Stato per l'alert delle opinioni incomplete
  const [showOpinioniAlert, setShowOpinioniAlert] = useState(false);
  const [opinioniAlertData, setOpinioniAlertData] = useState<any>(null);

  // Gestione stati di loading e autenticazione
  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  // Se non c'è utente e non stiamo caricando, reindirizza al login
  if (!user && !isAuthLoading) {
    return <Redirect to="/auth" />;
  }

  // Se non c'è utente (caso di fallback), reindirizza al login
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Funzione semplice per controllare se tutte le opinioni sono complete
  const checkOpinioniComplete = async (): Promise<boolean> => {
    console.log('🔍 DEBUG Preferiti - Controllo se tutte le opinioni sono complete');
    
    try {
      // Controlla tutti i gradi: N, E, R, CO
      const gradi = ['N', 'E', 'R', 'CO'];
      
      for (const grado of gradi) {
        console.log(`🔍 DEBUG Preferiti - Controllo grado: ${grado}`);
        const response = await apiRequest("GET", `/api/opinioni/check-missing/${grado}`);
        
        console.log(`🔍 DEBUG Preferiti - Risposta per grado ${grado}:`, response);
        
        // apiRequest restituisce { ok, status, data } dove data contiene la risposta JSON
        if (!response?.ok || !response?.data) {
          console.error(`❌ DEBUG Preferiti - Errore nella risposta per grado ${grado}`);
          continue; // Continua con il prossimo grado invece di permettere l'accesso
        }
        
        const apiData = response.data;
        if (apiData.success && apiData.data && !apiData.data.isComplete) {
          console.log(`⚠️ DEBUG Preferiti - Opinion incomplete trovate nel grado ${grado}:`, apiData.data);
          return false; // Trovate opinioni incomplete
        }
      }
      
      console.log('✅ DEBUG Preferiti - Tutte le opinioni sono complete');
      return true; // Tutte complete
      
    } catch (error) {
      console.error("❌ Errore nel controllo opinioni:", error);
      // In caso di errore, considera le opinioni incomplete per sicurezza
      return false;
    }
  };

  // Funzione per gestire la navigazione con controllo opinioni
  const handleNavigate = async (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    
    console.log('🔍 DEBUG handleNavigate - Path:', path);
    
    // Controlla se è una categoria che richiede opinioni complete
    const categoria = path.startsWith('/rappresentanti') ? 'politici' : 
                      path.startsWith('/candidati') ? 'candidati' : null;
    
    if (categoria) {
      console.log(`🔍 DEBUG handleNavigate - Categoria richiede controllo: ${categoria}`);
      const tutteComplete = await checkOpinioniComplete();
      console.log(`🔍 DEBUG handleNavigate - Tutte complete? ${tutteComplete}`);
      
      if (!tutteComplete) {
        console.log('⚠️ DEBUG handleNavigate - Opinion incomplete, mostro alert');
        // Calcola dati aggregati per l'alert
        try {
          const gradi = ['N', 'E', 'R', 'CO'];
          let totaleOpinioni = 0;
          let opinioniRisposte = 0;
          let totaliMancanti = 0;
          const allMissingOpinions: any[] = [];
          
          for (const grado of gradi) {
            const response = await apiRequest("GET", `/api/opinioni/check-missing/${grado}`);
            // apiRequest restituisce { ok, status, data } dove data contiene la risposta JSON
            if (response?.ok && response?.data) {
              const apiData = response.data;
              if (apiData.success && apiData.data) {
                totaleOpinioni += apiData.data.totaleOpinioni || 0;
                opinioniRisposte += apiData.data.opinioniRisposte || 0;
                totaliMancanti += apiData.data.opinioniMancanti || 0;
                if (apiData.data.missingOpinions) {
                  allMissingOpinions.push(...apiData.data.missingOpinions);
                }
              }
            }
          }
          
          const percentualeCompletamento = totaleOpinioni > 0 
            ? Math.round((opinioniRisposte / totaleOpinioni) * 100)
            : 0;
          
          setOpinioniAlertData({
            grado: 'Tutti',
            totaleOpinioni,
            opinioniRisposte,
            opinioniMancanti: totaliMancanti,
            percentualeCompletamento,
            isComplete: false,
            missingOpinions: allMissingOpinions
          });
        } catch (error) {
          console.error('❌ Errore nel calcolo dati alert:', error);
          // Fallback con dati minimi
          setOpinioniAlertData({
            grado: 'Tutti',
            totaleOpinioni: 0,
            opinioniRisposte: 0,
            opinioniMancanti: 0,
            percentualeCompletamento: 0,
            isComplete: false,
            missingOpinions: []
          });
        }
        setShowOpinioniAlert(true);
        return;
      }
    }
    
    // Se le opinioni sono complete o non è una categoria che le richiede, naviga normalmente
    console.log('✅ DEBUG handleNavigate - Navigazione permessa');
    setLocation(path);
  };

  // Handler per "Vai alle Opinion"
  const handleGoToOpinions = () => {
    setShowOpinioniAlert(false);
    setLocation('/opinioni');
  };


  return (
    <PageContainer className="preferiti-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none">
      <div className="container mx-auto px-4 py-2 flex flex-col">
        <div className="w-full max-w-4xl mx-auto flex flex-col">
          {/* Header */}
          <Card className="w-full flex-shrink-0">
            <div className="p-3 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Heart className="h-6 w-6 text-red-500" />
                <h1 className="text-xl font-bold text-gray-900" data-testid="preferiti-title">Preferiti</h1>
              </div>
              <p className="text-gray-600 text-sm">
                Scegli la categoria che ti interessa
              </p>
            </div>
          </Card>

          {/* Grid dei pulsanti */}
          <div className="mt-2 flex-1">
            <div className="grid grid-cols-2 gap-1 min-h-0">
              {preferitiItems.map((item) => (
                <PreferitiButton
                  key={item.id}
                  path={item.path}
                  icon={item.icon}
                  label={item.label}
                  color={item.color}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
            
            {/* Pulsanti Opinioni e Vota spostati dal Menu */}
            <div className="mt-4 grid grid-cols-2 gap-1">
              <PreferitiButton
                path="/opinioni"
                icon={MessageSquare}
                label="Opinioni"
                color={{
                  bg: "#e0f2fe",
                  icon: "#0891b2"
                }}
                onNavigate={(path, event) => {
                  event.preventDefault();
                  setLocation(path);
                }}
              />
              <PreferitiButton
                path="/vota"
                icon={Vote}
                label="Vota"
                color={{
                  bg: "#dcfce7",
                  icon: "#16a34a"
                }}
                onNavigate={(path, event) => {
                  event.preventDefault();
                  setLocation(path);
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Alert per opinioni incomplete */}
      {showOpinioniAlert && opinioniAlertData && (
        <OpinioniIncompleteAlert
          open={showOpinioniAlert}
          onOpenChange={setShowOpinioniAlert}
          data={opinioniAlertData}
          onGoToOpinions={handleGoToOpinions}
        />
      )}
    </PageContainer>
  );
}
