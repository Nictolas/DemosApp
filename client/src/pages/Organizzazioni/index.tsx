import React from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect } from "wouter";
import { Building2, Construction, ArrowLeft } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Organizzazioni() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect se non autenticato
  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer>
      <div className="min-h-screen bg-gray-50 pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation("/preferiti")}
              className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Torna ai Preferiti
            </Button>
          </div>

          {/* Card principale */}
          <Card className="w-full">
            <div className="p-8 text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Building2 className="h-16 w-16 text-purple-500" />
                <Construction className="h-12 w-12 text-orange-500" />
              </div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Organizzazioni
              </h1>
              
              <p className="text-lg text-gray-600 mb-6">
                Questa sezione è attualmente in costruzione
              </p>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-purple-800 mb-3">
                  Cosa troverai qui
                </h2>
                <ul className="text-left text-purple-700 space-y-2 max-w-md mx-auto">
                  <li>• Lista delle organizzazioni politiche</li>
                  <li>• Profili dettagliati delle organizzazioni</li>
                  <li>• Programmi e obiettivi</li>
                  <li>• Eventi e iniziative</li>
                  <li>• Possibilità di aderire</li>
                </ul>
              </div>
              
              <p className="text-gray-500">
                Stiamo lavorando per portarti questa funzionalità al più presto!
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
