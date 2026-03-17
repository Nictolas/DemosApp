import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, Vote } from "lucide-react";
import { VOTING_LIMITS, VotingCategory } from "@/config/votingLimits";

interface VotingLimitsInfoProps {
  category: VotingCategory;
  currentVotes: number;
  className?: string;
}

export const VotingLimitsInfo: React.FC<VotingLimitsInfoProps> = ({
  category,
  currentVotes,
  className = ""
}) => {
  const limit = VOTING_LIMITS[category];
  const remainingVotes = Math.max(0, limit - currentVotes);
  const hasReachedLimit = remainingVotes === 0;
  const percentage = (currentVotes / limit) * 100;

  const getCategoryLabel = (cat: VotingCategory): string => {
    const labels: Record<VotingCategory, string> = {
      opinioni_proposte: "Opinioni Proposte",
      capo_stato: "Capo di Stato",
      iniziative_popolari: "Iniziative Popolari",
      referendum_abrogativi: "Referendum Abrogativi",
      ice: "ICE",
      ministri: "Ministri",
      amnistia: "Amnistia",
      grazia: "Grazia",
      comunicazioni: "Comunicazioni"
    };
    return labels[cat];
  };

  return (
    <Card className={`bg-white ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-lg">
          <Vote className="h-5 w-5" />
          <span>Limiti di Voto</span>
        </CardTitle>
        <CardDescription>
          Informazioni sui limiti di voto per categoria
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{getCategoryLabel(category)}</span>
            <Badge variant={hasReachedLimit ? "destructive" : "secondary"}>
              {currentVotes}/{limit}
            </Badge>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                hasReachedLimit ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>
              {hasReachedLimit 
                ? `Limite raggiunto. Rimuovi un voto per votarne uno nuovo.`
                : `${remainingVotes} voti rimanenti`
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
