import React, { useEffect } from "react";
import { Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMenuData } from "./hooks/useMenuData";
import { useMenuActions } from "./hooks/useMenuActions";
import { MenuHeader } from "./components/MenuHeader";
import { MenuGrid } from "./components/MenuGrid";
import { useQueryClient } from "@tanstack/react-query";

export default function Menu() {
  const { user, isLoading, isAdmin, hasAdvancedAccess } = useMenuData();
  const { navigateWithButtonReset, setLocation } = useMenuActions();
  const queryClient = useQueryClient();

  // Forza il refetch dei dati utente quando il componente viene montato
  useEffect(() => {
    queryClient.invalidateQueries(['user']);
  }, [queryClient]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white select-none overflow-hidden page-with-navbar" style={{ paddingBottom: '160px' }}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto px-4 py-4 h-full flex flex-col">
          <Card className="w-full max-w-4xl mx-auto flex-1 flex flex-col">
            <MenuHeader 
              isAdmin={isAdmin}
              onAdminClick={() => setLocation("/gestisci")}
            />
            <MenuGrid 
              hasAdvancedAccess={hasAdvancedAccess}
              onNavigate={navigateWithButtonReset}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
