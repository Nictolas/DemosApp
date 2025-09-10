import React, { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMenuData } from "./hooks/useMenuData";
import { useMenuActions } from "./hooks/useMenuActions";
import { MenuHeader } from "./components/MenuHeader";
import { MenuGrid } from "./components/MenuGrid";
import { PageContainer } from "@/components/PageContainer";
import { useQueryClient } from "@tanstack/react-query";

export default function Menu() {
  const { user, isLoading, isAdmin, hasAdvancedAccess } = useMenuData();
  const { navigateWithButtonReset, setLocation } = useMenuActions();
  const queryClient = useQueryClient();
  const [isAndroid, setIsAndroid] = useState(false);

  // Rileva se è un dispositivo Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(userAgent.includes('android'));
  }, []);

  // Forza il refetch dei dati utente quando il componente viene montato
  useEffect(() => {
    queryClient.invalidateQueries(['user']);
  }, [queryClient]);

  // Redirect to auth page if not logged in (ma solo se non c'è token)
  const hasToken = localStorage.getItem('auth_token');
  if (!user && !isLoading && !hasToken) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className={`menu-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none ${isAndroid ? 'android' : ''}`}>
      {isLoading || !user ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
          <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
            <Card className="w-full">
              <MenuHeader 
                isAdmin={isAdmin}
                onAdminClick={() => setLocation("/gestisci")}
              />
            </Card>
            <div className="mt-4">
              <MenuGrid 
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
