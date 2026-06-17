import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Users, Award, UserCheck, Building2, MessageSquare, Vote } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardHeader } from "@/components/ui/card";
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
      className="menu-button relative w-full h-32 rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform flex-shrink-0"
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
    icon: Award,
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
      bg: "#fce7f3",
      icon: "#db2777"
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

  const hasToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Loader mentre l'autenticazione è in corso e abbiamo un token
  if (isAuthLoading && hasToken) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  // Se non c'è token e non stiamo caricando, l'utente non è autenticato → vai ad /auth
  if (!hasToken && !isAuthLoading) {
    return <Redirect to="/auth" />;
  }

  /** Un solo round-trip per N/E/R/CO (vedi GET /api/opinioni/check-missing-all). */
  const fetchOpinioniCheckAggregated = async () => {
    const response = await apiRequest("GET", "/api/opinioni/check-missing-all");
    if (!response?.ok || !response?.data) return null;
    const apiData = response.data as {
      success?: boolean;
      data?: {
        allComplete: boolean;
        totaleOpinioni: number;
        opinioniRisposte: number;
        opinioniMancanti: number;
        percentualeCompletamento: number;
        missingOpinions?: unknown[];
      };
    };
    if (!apiData.success || !apiData.data) return null;
    return apiData.data;
  };

  // Funzione per gestire la navigazione con controllo opinioni
  const handleNavigate = async (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    
    console.log('🔍 DEBUG handleNavigate - Path:', path);
    
    // Controlla se è una categoria che richiede opinioni complete (stesso alert per tutti)
    const richiedeOpinioniComplete =
      path.startsWith('/rappresentanti') ||
      path.startsWith('/candidati') ||
      path.startsWith('/attivisti') ||
      path.startsWith('/organizzazioni') ||
      path.startsWith('/vota');
    
    if (richiedeOpinioniComplete) {
      console.log(`🔍 DEBUG handleNavigate - Path richiede controllo opinioni: ${path}`);
      try {
        const agg = await fetchOpinioniCheckAggregated();
        const tutteComplete = agg?.allComplete === true;
        console.log(`🔍 DEBUG handleNavigate - Tutte complete? ${tutteComplete}`);

        if (!agg) {
          setOpinioniAlertData({
            grado: 'Tutti',
            totaleOpinioni: 0,
            opinioniRisposte: 0,
            opinioniMancanti: 0,
            percentualeCompletamento: 0,
            isComplete: false,
            missingOpinions: []
          });
          setShowOpinioniAlert(true);
          return;
        }

        if (!tutteComplete) {
          console.log('⚠️ DEBUG handleNavigate - Opinion incomplete, mostro alert');
          setOpinioniAlertData({
            grado: 'Tutti',
            totaleOpinioni: agg.totaleOpinioni,
            opinioniRisposte: agg.opinioniRisposte,
            opinioniMancanti: agg.opinioniMancanti,
            percentualeCompletamento: agg.percentualeCompletamento,
            isComplete: false,
            missingOpinions: (agg.missingOpinions || []) as any[]
          });
          setShowOpinioniAlert(true);
          return;
        }
      } catch (error) {
        console.error('❌ Errore nel controllo opinioni aggregate:', error);
        setOpinioniAlertData({
          grado: 'Tutti',
          totaleOpinioni: 0,
          opinioniRisposte: 0,
          opinioniMancanti: 0,
          percentualeCompletamento: 0,
          isComplete: false,
          missingOpinions: []
        });
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
          {/* Logo app: cliccabile solo per AD → /gestisci */}
          <Card className="w-full flex-shrink-0 mb-2">
            <CardHeader className="text-center flex-shrink-0 pt-3 pb-1">
              {user?.ruolo === "AD" ? (
                <button
                  type="button"
                  onClick={() => setLocation("/gestisci")}
                  className="block mx-auto cursor-pointer hover:opacity-80 hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
                  title="Clicca per accedere alla sezione Gestisci"
                  aria-label="Vai a Gestisci"
                >
                  <img
                    src="/icona.png"
                    alt="Logo Demos"
                    className="w-24 h-24 mx-auto"
                    data-testid="preferiti-logo"
                  />
                </button>
              ) : (
                <img
                  src="/icona.png"
                  alt="Logo Demos"
                  className="w-24 h-24 mx-auto"
                  data-testid="preferiti-logo"
                />
              )}
            </CardHeader>
          </Card>

          {/* Grid dei pulsanti */}
          <div className="mt-2 flex-1">
            <div className="grid grid-cols-2 gap-4 min-h-0">
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
            <div className="mt-4 grid grid-cols-2 gap-4">
              <PreferitiButton
                path="/opinioni"
                icon={MessageSquare}
                label="Opinioni"
                color={{
                  bg: "#fef2f2",
                  icon: "#dc2626"
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
