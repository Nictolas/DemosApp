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
import SondaggiContent from "@/components/sondaggi/SondaggiContent";

export default function Sondaggi() {
  const { user, isLoading, isError, hasAdvancedAccess, sondaggiData, genereData } = useSondaggiData();
  const { prepareGenerePieData, calculateTotalVotes } = useSondaggiUtils();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-b from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return <Redirect to="/auth" />;
  if (!hasAdvancedAccess) return <Redirect to="/menu" />;

  const generePieData = prepareGenerePieData(genereData);
  const totalVotes = calculateTotalVotes(sondaggiData?.stats);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar overflow-y-auto">
      <div className="w-full px-4 lg:px-8 py-6">
        <Header />

        {/* Loading e Error States */}
        {isLoading && <LoadingState />}
        {isError && <ErrorState />}

        {/* Contenuto principale */}
        {sondaggiData ? (
          <div className="space-y-8">
            <StatsCards 
              sondaggiData={sondaggiData}
              totalVotes={totalVotes}
            />

            <RegioniGrid />

            {/* Contenuto dei sondaggi nazionali */}
            <SondaggiContent />

            {/* Grafico a torta del genere */}
            {generePieData && generePieData.length > 0 && (
              <GenereChart generePieData={generePieData} />
            )}
          </div>
        ) : !isLoading && !isError ? (
          <div className="space-y-8">
            <RegioniGrid />
            <SondaggiContent />
          </div>
        ) : null}
      </div>
    </div>
  );
}
