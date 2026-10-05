import React, { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useTestData } from "./hooks/useTestData";
import { useTestActions } from "./hooks/useTestActions";
import { TestHeader } from "./components/TestHeader";
import { TestGrid } from "./components/TestGrid";
import { PageContainer } from "@/components/PageContainer";

export default function Test() {
  const { user, isLoading, isAdmin, hasAdvancedAccess } = useTestData();
  const { navigateWithButtonReset } = useTestActions();
  const queryClient = useQueryClient();
  const [isAndroid, setIsAndroid] = useState(false);

  // Rileva se è un dispositivo Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(userAgent.includes('android'));
  }, []);

  // Forza il refetch dei dati utente quando il componente viene montato
  useEffect(() => {
    queryClient.invalidateQueries(['testSelezioni']);
  }, [queryClient]);

  // Redirect to auth page if not logged in (ma solo se non c'è token)
  const hasToken = localStorage.getItem('auth_token');
  if (!hasToken) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className={`test-page flex flex-col bg-linear-to-b from-amber-50 to-white select-none ${isAndroid ? 'android' : ''}`}>
      {isLoading || !user ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
          <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
            <Card className="w-full">
              <TestHeader 
                isAdmin={isAdmin}
                onAdminClick={() => navigateWithButtonReset("/gestisci")}
              />
            </Card>
            <div className="mt-4">
              <TestGrid 
                hasAdvancedAccess={hasAdvancedAccess}
                onNavigate={navigateWithButtonReset}
              />
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
