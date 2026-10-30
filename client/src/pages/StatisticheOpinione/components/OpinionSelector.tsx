import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { loadOpinionCategory, type OpinionGrade } from "@/lib/encryptedOpinionCache";
import { useAuth } from "@/hooks/use-auth";

// The statistics selector has historically used Italian grade labels,
// while the encrypted editor snapshots use stable grade codes. A familiar
// label must resolve to the SAME cache as the corresponding opinion editor.
const cacheGradeByLabel: Readonly<Record<string, OpinionGrade>> = {
  n: "N", nazionale: "N", nazionali: "N",
  e: "E", europeo: "E", europea: "E", europee: "E", europei: "E",
  r: "R", regionale: "R", regionali: "R",
  co: "CO", comunale: "CO", comunali: "CO",
};

interface OpinionQuestion {
  id: string;
  text: string;
}

interface OpinionSelectorProps {
  grado?: string;
}

export function OpinionSelector({ grado = "Nazionale" }: OpinionSelectorProps) {
  const { user, isSessionVerified, verifiedPoliticalConsent } = useAuth();
  const cacheGrade = Object.prototype.hasOwnProperty.call(cacheGradeByLabel, grado.trim().toLowerCase())
    ? cacheGradeByLabel[grado.trim().toLowerCase()] : null;
  const canReadOpinions = !!user?.id && isSessionVerified &&
    verifiedPoliticalConsent?.granted === true && !!verifiedPoliticalConsent.timestamp;
  const { data: questionsData, isLoading, isError } = useQuery<{
    success: boolean;
    data: OpinionQuestion[];
    grado: string;
    total: number;
  }>({
    // Personalized userAnswer values must never be shared across accounts,
    // revocation/regrant epochs or the four opinion entry editors.
    queryKey: ['statsOpinionQuestions', user?.id, verifiedPoliticalConsent?.timestamp, grado],
    enabled: !!user?.id && isSessionVerified && verifiedPoliticalConsent?.granted === true &&
      !!verifiedPoliticalConsent.timestamp,
    queryFn: async ({ signal }) => {
      // Reuse the editor's verified-consent, per-account encrypted snapshot.
      // A valid warm cache makes ZERO personal-answer GETs here.
      if (cacheGrade) {
        return loadOpinionCategory(user!.id, verifiedPoliticalConsent!.timestamp,
          cacheGrade, signal);
      }
      // Preserve the old behavior only for unknown legacy grade labels.
      const response = await apiRequest("GET", `/api/opinioni-list?grado=${grado}`,
        undefined, undefined, signal);
      return response.data;
    },
  });

  // Disabling a TanStack query does not discard its previously cached data.
  // Never display personal political answers after consent/session loss while
  // the logout/revoke cleanup is still cancelling and removing RAM queries.
  if (!canReadOpinions) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError || !questionsData?.data) {
    return (
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Errore nel caricamento delle opinioni disponibili.
          </div>
        </CardContent>
      </Card>
    );
  }

  const questions = questionsData.data;

  return (
    <div className="space-y-6">
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-gray-800 flex items-center">
            <BarChart3 className="mr-2 h-6 w-6 text-blue-600" />
            Seleziona un'Opinione per Visualizzare le Statistiche
          </CardTitle>
          <CardDescription className="text-gray-600">
            Scegli un'opinione dalla lista per visualizzare le statistiche dettagliate
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {questions.map((question) => (
              <Link key={question.id} href={`/statistiche-opinione/${question.id}`}>
                <Button 
                  variant="outline" 
                  className="w-full h-20 text-left justify-start hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{question.text}</span>
                    <span className="text-xs text-gray-500 mt-1">Visualizza statistiche</span>
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
