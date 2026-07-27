import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Users, Award, UserCheck, Building2, MessageSquare, Vote } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card, CardHeader } from "@/components/ui/card";
import { OpinioniIncompleteAlert } from "@/pages/ScegliRappresentante/components/OpinioniIncompleteAlert";
import { apiRequest } from "@/lib/queryClient";
import { useMobileLayout } from "@/hooks/useMobileLayout";
import { PreferitiDesktopHub } from "./PreferitiDesktopHub";

interface PreferitiButtonProps {
  path: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  description: string;
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
  description,
  color,
  onNavigate,
}) => {
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add("scale-95", "shadow-md");
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove("scale-95", "shadow-md");
    onNavigate(path, e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove("scale-95", "shadow-md");
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.add("scale-95", "shadow-md");
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove("scale-95", "shadow-md");
    onNavigate(path, e);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <button
      type="button"
      className="preferiti-button relative w-full h-full rounded-2xl shadow-lg overflow-hidden cursor-pointer transition-transform"
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
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-2 py-3">
        <span className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 mb-1 shrink-0">
          <Icon className="h-8 w-8 sm:h-10 sm:w-10 text-white absolute" style={{ filter: "drop-shadow(0 0 0 #fff)" }} />
          <Icon className="h-6 w-6 sm:h-8 sm:w-8 relative z-10" style={{ color: color.icon }} />
        </span>
        <div
          className={`text-gray-700 font-semibold select-none text-center leading-tight text-sm sm:text-base ${
            label === "Organizzazioni" ? "text-xs sm:text-sm" : ""
          }`}
        >
          {label}
        </div>
        <div className="preferiti-button__description mt-1 text-center text-[11px] leading-snug text-gray-500">
          {description}
        </div>
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
    description: "I tuoi rappresentanti di riferimento",
    color: { bg: "#dbeafe", icon: "#2563eb" },
  },
  {
    id: "candidati",
    path: "/candidati",
    icon: Award,
    label: "Candidati",
    description: "Profili e proposte dei candidati",
    color: { bg: "#fef3c7", icon: "#d97706" },
  },
  {
    id: "attivisti",
    path: "/attivisti",
    icon: UserCheck,
    label: "Attivisti",
    description: "Persone attive sul territorio",
    color: { bg: "#fce7f3", icon: "#db2777" },
  },
  {
    id: "organizzazioni",
    path: "/organizzazioni",
    icon: Building2,
    label: "Organizzazioni",
    description: "Associazioni, gruppi e realta locali",
    color: { bg: "#f3e8ff", icon: "#9333ea" },
  },
  {
    id: "opinioni",
    path: "/opinioni",
    icon: MessageSquare,
    label: "Opinioni",
    description: "Le tue posizioni sui temi principali",
    color: { bg: "#fef2f2", icon: "#dc2626" },
    skipOpinioniCheck: true,
  },
  {
    id: "vota",
    path: "/vota",
    icon: Vote,
    label: "Vota",
    description: "Esprimi il tuo voto sulle proposte",
    color: { bg: "#dcfce7", icon: "#16a34a" },
    skipOpinioniCheck: true,
  },
] as const;

export default function Preferiti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isMobileLayout = useMobileLayout();

  const [showOpinioniAlert, setShowOpinioniAlert] = useState(false);
  const [opinioniAlertData, setOpinioniAlertData] = useState<any>(null);

  const hasToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

  if (isAuthLoading && hasToken) {
    return (
      <PageContainer>
        <div className="flex flex-1 items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </PageContainer>
    );
  }

  if (!hasToken && !isAuthLoading) {
    return <Redirect to="/auth" />;
  }

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

  const requiresOpinioniComplete = (path: string) =>
    path.startsWith("/rappresentanti") ||
    path.startsWith("/scegli-rappresentante") ||
    path.startsWith("/candidati") ||
    path.startsWith("/attivisti") ||
    path.startsWith("/organizzazioni") ||
    path.startsWith("/vota") ||
    path.startsWith("/capo-di-stato") ||
    path.startsWith("/governo") ||
    path.startsWith("/grazia") ||
    path.startsWith("/amnistia") ||
    path.startsWith("/vota-iniziativa") ||
    path.startsWith("/vota-referendum");

  const navigateWithOpinioniGate = async (
    path: string,
    options?: { skipOpinioniCheck?: boolean },
  ) => {
    if (!options?.skipOpinioniCheck && requiresOpinioniComplete(path)) {
      try {
        const agg = await fetchOpinioniCheckAggregated();
        const tutteComplete = agg?.allComplete === true;

        if (!agg || !tutteComplete) {
          setOpinioniAlertData({
            grado: "Tutti",
            totaleOpinioni: agg?.totaleOpinioni ?? 0,
            opinioniRisposte: agg?.opinioniRisposte ?? 0,
            opinioniMancanti: agg?.opinioniMancanti ?? 0,
            percentualeCompletamento: agg?.percentualeCompletamento ?? 0,
            isComplete: false,
            missingOpinions: (agg?.missingOpinions || []) as unknown[],
          });
          setShowOpinioniAlert(true);
          return;
        }
      } catch {
        setOpinioniAlertData({
          grado: "Tutti",
          totaleOpinioni: 0,
          opinioniRisposte: 0,
          opinioniMancanti: 0,
          percentualeCompletamento: 0,
          isComplete: false,
          missingOpinions: [],
        });
        setShowOpinioniAlert(true);
        return;
      }
    }

    setLocation(path);
  };

  const handleNavigate = async (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await navigateWithOpinioniGate(path);
  };

  const handleGoToOpinions = () => {
    setShowOpinioniAlert(false);
    setLocation("/opinioni");
  };

  if (!isMobileLayout) {
    return (
      <PageContainer className="preferiti-page preferiti-page--desktop bg-slate-50">
        <PreferitiDesktopHub
          user={user}
          onNavigate={navigateWithOpinioniGate}
        />
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

  return (
    <PageContainer className="preferiti-page bg-gradient-to-b from-blue-50 to-white select-none">
      <div className="preferiti-page__inner flex h-full min-h-0 flex-col px-3 py-1 sm:px-4 sm:py-2">
        <Card className="preferiti-page__logo w-full shrink-0 shadow-sm">
            <CardHeader className="text-center py-1 px-3 sm:py-2 sm:px-4">
              {user?.ruolo === "AD" ? (
                <button
                  type="button"
                  onClick={() => setLocation("/gestisci")}
                  className="block mx-auto cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-full"
                  title="Clicca per accedere alla sezione Gestisci"
                  aria-label="Vai a Gestisci"
                >
                  <img
                    src="/icona.png"
                    alt="Logo Demos"
                    className="preferiti-page__logo-img w-16 h-16 sm:w-20 sm:h-20 mx-auto"
                    data-testid="preferiti-logo"
                  />
                </button>
              ) : (
                <img
                  src="/icona.png"
                  alt="Logo Demos"
                  className="preferiti-page__logo-img w-16 h-16 sm:w-20 sm:h-20 mx-auto"
                  data-testid="preferiti-logo"
                />
              )}
          </CardHeader>
        </Card>

        <div className="preferiti-page__grid mt-2 flex-1 min-h-0 gap-2 sm:gap-3">
          {preferitiItems.map((item) => (
            <PreferitiButton
              key={item.id}
              path={item.path}
              icon={item.icon}
              label={item.label}
              description={item.description}
              color={item.color}
              onNavigate={(path, event) => {
                if (item.id === "opinioni") {
                  event.preventDefault();
                  setLocation(path);
                  return;
                }
                handleNavigate(path, event);
              }}
            />
          ))}
        </div>
      </div>

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
