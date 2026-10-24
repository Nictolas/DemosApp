import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { opinionQuestionsKey } from "@/lib/opinionQueryKeys";

interface OpinionQuestion {
  id: string;
  text: string;
}

interface OpinionSelectorProps {
  grado?: string;
}

export function OpinionSelector({ grado = "Nazionale" }: OpinionSelectorProps) {
  const { user } = useAuth();
  const { data: questionsData, isLoading, isError } = useQuery<{
    success: boolean;
    data: OpinionQuestion[];
    grado: string;
    total: number;
  }>({
    queryKey: opinionQuestionsKey(grado, user?.id),
    queryFn: async ({ signal }) => {
      console.log('🔍 DEBUG - Caricamento opinioni per selettore...');
      // apiRequest restituisce già il JSON parsato, non un Response
      const data = await apiRequest("GET", `/api/opinioni-list?grado=${grado}`, undefined, undefined, signal);
      console.log('🔍 DEBUG - Risposta API selettore:', data);
      return data;
    },
    enabled: !!user,
  });

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
