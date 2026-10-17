import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useNoScroll } from "@/hooks/useNoScroll";
import { useReferendumVoteAvailability } from "@/hooks/useReferendumVoteAvailability";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Crown, Building2, Scale, Archive, Users, Vote, type LucideIcon } from "lucide-react";

type VoteCardProps = {
  path: string;
  label: React.ReactNode;
  icon: LucideIcon;
  accent: string;
  soft: string;
  className?: string;
};

function VoteCard({ path, label, icon: Icon, accent, soft, className = "" }: VoteCardProps) {
  return (
    <button
      type="button"
      className={`relative w-full h-40 rounded-2xl shadow-lg active:shadow overflow-hidden cursor-pointer active:scale-95 transition-transform ${className}`}
      onClick={() => { window.location.href = path; }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points="100,0 0,0 0,35 100,20" fill={soft} />
        <polygon points="100,20 0,35 0,100 100,100" fill="#fff" />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <span className="relative flex items-center justify-center w-16 h-16 mb-2">
          <Icon className="h-12 w-12 text-white absolute" style={{ filter: "drop-shadow(0 0 0 #fff)" }} />
          <Icon className="h-8 w-8 relative z-10" style={{ color: accent }} />
        </span>
        <div className="text-gray-700 font-semibold text-lg select-none text-center">{label}</div>
      </div>
    </button>
  );
}

export default function Vota() {
  const { user, isLoading } = useAuth();
  const { available: referendumAvailable } = useReferendumVoteAvailability();

  useNoScroll(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between" />

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Crown className="h-6 w-6 text-purple-600" />
              Vota
            </CardTitle>
            <CardDescription>
              Partecipa alle votazioni democratiche. Seleziona la categoria per esprimere il tuo voto.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-2 gap-6">
          <VoteCard
            path="/capo-di-stato"
            label="Capo di Stato"
            icon={Crown}
            accent="#9333ea"
            soft="#ede9fe"
          />
          <VoteCard
            path="/governo"
            label="Governo"
            icon={Building2}
            accent="#db2777"
            soft="#fbcfe8"
          />
          <VoteCard
            path="/grazia"
            label="Grazia"
            icon={Scale}
            accent="#16a34a"
            soft="#bbf7d0"
          />
          <VoteCard
            path="/amnistia"
            label="Amnistia"
            icon={Archive}
            accent="#0d9488"
            soft="#5eead4"
          />
          <VoteCard
            path="/vota-iniziativa-popolare"
            label={<>Iniziativa<br />Popolare</>}
            icon={Users}
            accent="#2563eb"
            soft="#93c5fd"
            className={referendumAvailable ? "" : "col-span-2"}
          />
          {referendumAvailable && (
            <VoteCard
              path="/vota-referendum"
              label="Referendum"
              icon={Vote}
              accent="#dc2626"
              soft="#fca5a5"
            />
          )}
        </div>
      </div>
    </div>
  );
}
