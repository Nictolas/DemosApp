import React, { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useMenuData } from "./hooks/useMenuData";
import { useMenuActions } from "./hooks/useMenuActions";
import { MenuHeader } from "./components/MenuHeader";
import { MenuGrid } from "./components/MenuGrid";
import { PageContainer } from "@/components/PageContainer";
import ProssimoEventoRiquadro from "@/components/ProssimoEventoRiquadro";
import ProssimaIniziativaRiquadro from "@/components/ProssimaIniziativaRiquadro";
import ProssimoReferendumRiquadro from "@/components/ProssimoReferendumRiquadro";
import UltimaNotificaRiquadro from "@/components/UltimaNotificaRiquadro";

export default function Menu() {
  const { user, isLoading, isAdmin, hasAdvancedAccess, hasLimitedAccess } = useMenuData();
  const { navigateWithButtonReset, setLocation } = useMenuActions();
  const [isAndroid, setIsAndroid] = useState(false);

  // Debug logging rimosso per evitare re-render


  // Rileva se è un dispositivo Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(userAgent.includes('android'));
  }, []);

  // Redirect to auth page if not logged in (ma solo se non c'è token)
  const hasToken = localStorage.getItem('auth_token');
  if (!user && !isLoading && !hasToken) {
    return <Redirect to="/auth" />;
  }

  // Mostra loader se l'utente non è ancora caricato ma c'è un token
  if ((isLoading || !user) && hasToken) {
    return (
      <PageContainer className={`menu-page flex flex-col bg-linear-to-b from-blue-50 to-white select-none ${isAndroid ? 'android' : ''}`}>
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
          <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <div className={`menu-page flex flex-col bg-linear-to-b from-blue-50 to-white select-none ${isAndroid ? 'android' : ''}`} style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
      <div className="container mx-auto px-4 py-4 flex flex-col" style={{ flex: '0 0 auto' }}>
        <div className="w-full max-w-4xl mx-auto flex flex-col pb-4">
          <Card className="w-full shrink-0">
            <MenuHeader 
              key={`header-${user?.email || 'no-user'}`}
              isAdmin={isAdmin}
              onAdminClick={() => setLocation("/gestisci")}
            />
          </Card>
          <div className="mt-0 flex flex-col">
            <MenuGrid 
              key="menu-grid"
              hasAdvancedAccess={hasAdvancedAccess}
              hasLimitedAccess={hasLimitedAccess}
              userRole={user?.ruolo}
              onNavigate={navigateWithButtonReset}
            />
            
            {/* Riquadri per Prossimo Evento, Iniziativa Popolare, Referendum e Ultima Notifica - Layout 2 per riga */}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <UltimaNotificaRiquadro />
              <ProssimoEventoRiquadro />
              <ProssimaIniziativaRiquadro />
              <ProssimoReferendumRiquadro />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
