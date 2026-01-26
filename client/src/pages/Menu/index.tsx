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
import ProssimoEventoRiquadro from "@/components/ProssimoEventoRiquadro";
import ProssimaIniziativaRiquadro from "@/components/ProssimaIniziativaRiquadro";
import ProssimoReferendumRiquadro from "@/components/ProssimoReferendumRiquadro";
import UltimaNotificaRiquadro from "@/components/UltimaNotificaRiquadro";

export default function Menu() {
  const { user, isLoading, isAdmin, hasAdvancedAccess, hasLimitedAccess } = useMenuData();
  const { navigateWithButtonReset, setLocation } = useMenuActions();
  const queryClient = useQueryClient();
  const [isAndroid, setIsAndroid] = useState(false);

  // Debug logging rimosso per evitare re-render

  // Debug DOM - Controlla se gli elementi sono nel DOM
  useEffect(() => {
    const checkDOM = () => {
      const menuTitle = document.querySelector('[data-testid="menu-title"]');
      const menuButtons = document.querySelectorAll('[data-testid="menu-button"]');
      const menuLogo = document.querySelector('[data-testid="menu-logo"]');
      
      console.log('🔍 DOM Check - Elementi trovati:', {
        menuTitle: !!menuTitle,
        menuButtons: menuButtons.length,
        menuLogo: !!menuLogo,
        menuTitleText: menuTitle?.textContent,
        menuButtonsText: Array.from(menuButtons).map(btn => btn.textContent)
      });
    };

    // Controlla immediatamente
    checkDOM();
    
    // Controlla dopo un delay
    const timer = setTimeout(checkDOM, 1000);
    
    return () => clearTimeout(timer);
  }, [user, hasAdvancedAccess]);

  // Forza re-render quando l'utente è disponibile
  useEffect(() => {
    if (user && !isLoading) {
      console.log('🔄 Menu - Utente disponibile, forzando re-render');
      // Forza un re-render del componente
      const timer = setTimeout(() => {
        console.log('🔄 Menu - Re-render completato');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user, isLoading]);

  // Rileva se è un dispositivo Android
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    setIsAndroid(userAgent.includes('android'));
  }, []);

  // Forza il refetch dei dati utente quando il componente viene montato
  useEffect(() => {
    queryClient.invalidateQueries(['user']);
  }, [queryClient]);

  // Debug: verifica che i riquadri vengano renderizzati
  useEffect(() => {
    console.log('🔍 Menu - Componente montato, riquadri dovrebbero essere visibili');
  }, []);

  // Redirect to auth page if not logged in (ma solo se non c'è token)
  const hasToken = localStorage.getItem('auth_token');
  if (!user && !isLoading && !hasToken) {
    return <Redirect to="/auth" />;
  }

  // Mostra loader se l'utente non è ancora caricato ma c'è un token
  if ((isLoading || !user) && hasToken) {
    return (
      <PageContainer className={`menu-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none ${isAndroid ? 'android' : ''}`}>
        <div className="container mx-auto px-4 py-4 flex-1 flex flex-col">
          <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <div className={`menu-page flex flex-col bg-gradient-to-b from-blue-50 to-white select-none ${isAndroid ? 'android' : ''}`} style={{ height: '100vh', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
      <div className="container mx-auto px-4 py-4 flex flex-col" style={{ minHeight: 'min-content' }}>
        <div className="w-full max-w-4xl mx-auto flex flex-col pb-4">
          <Card className="w-full flex-shrink-0">
            <MenuHeader 
              key={`header-${user?.email || 'no-user'}`}
              isAdmin={isAdmin}
              onAdminClick={() => setLocation("/gestisci")}
            />
          </Card>
          <div className="mt-4 flex flex-col">
            <MenuGrid 
              key={`grid-${user?.email || 'no-user'}-${hasAdvancedAccess}`}
              hasAdvancedAccess={hasAdvancedAccess}
              hasLimitedAccess={hasLimitedAccess}
              userRole={user?.ruolo}
              onNavigate={navigateWithButtonReset}
            />
            
            {/* Riquadri per Prossimo Evento, Iniziativa Popolare, Referendum e Ultima Notifica - Layout 1 per riga */}
            <div className="mt-4 flex flex-col gap-4">
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
