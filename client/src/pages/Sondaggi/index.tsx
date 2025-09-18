import React from "react";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";
import { useSondaggiData } from "./hooks/useSondaggiData";
import { useSondaggiUtils } from "./hooks/useSondaggiUtils";
import { Header } from "./components/Header";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { StatsCards } from "./components/StatsCards";
import { RegioniGrid } from "./components/RegioniGrid";
import { GenereChart } from "./components/GenereChart";
import SondaggiContent from "@/components/SondaggiContent";

export default function Sondaggi() {
  const { user, isLoading, isError, hasAdvancedAccess, sondaggiData, genereData } = useSondaggiData();
  const { prepareGenerePieData, calculateTotalVotes } = useSondaggiUtils();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/auth" />;
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  const generePieData = prepareGenerePieData(genereData);
  const totalVotes = calculateTotalVotes(sondaggiData?.stats);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar overflow-y-auto">
      <div className="w-full px-4 lg:px-8 py-6">
        <Header />

        {/* Loading e Error States */}
        {isLoading && <LoadingState />}
        {isError && <ErrorState />}

        {/* Contenuto principale */}
        {sondaggiData && (
          <div className="space-y-8">
            <StatsCards 
              sondaggiData={sondaggiData}
              totalVotes={totalVotes}
            />

            <RegioniGrid />

            {/* Contenuto dei sondaggi nazionali - solo grafici individuali */}
            <div className="space-y-8">
              {/* Grafici individuali per ogni opinione */}
              {sondaggiData?.questions?.map((question) => (
                <div key={question.id} className="bg-white shadow-lg rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">{question.text}</h3>
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Grafico per {question.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Grafico a torta del genere */}
            <GenereChart generePieData={generePieData} />
          </div>
        )}
      </div>
    </div>
  );
}
