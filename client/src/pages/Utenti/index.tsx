import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, AlertCircle, BarChart3 } from "lucide-react";
import { useUsers } from "./hooks/useUsers";
import { useUserManagement } from "./hooks/useUserManagement";
import { getDisplayColumns } from "./utils/columnUtils";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { FiltersBar } from "./components/FiltersBar";
import { UsersTable } from "./components/UsersTable";
import { MobileUsersTable } from "./components/MobileUsersTable";
import { Pagination } from "./components/Pagination";
import { USERS_PER_PAGE } from "./constants";
import { clearAllTokens, forceTokenRefresh } from "@/utils/tokenUtils";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { hasAdminCapability } from "@/lib/admin-access";

// Import per le statistiche
type StatisticheUtenti = {
  totalUsers: number;
  usersByRole: Record<string, number>;
  usersBySesso: Record<string, number>;
  usersByCitizenship: Record<string, number>;
  usersByRegion: Record<string, number>;
  usersByCity: Record<string, number>;
  usersByAge: Record<string, number>;
};

// Colori per i grafici - più colori per evitare duplicati
const COLORS = ['#87CEEB', '#FFB6C1', '#FFD700', '#98FB98', '#DDA0DD', '#F0E68C', '#FFA07A', '#20B2AA', '#FF6347', '#40E0D0', '#EE82EE', '#90EE90', '#F4A460', '#87CEFA', '#D8BFD8', '#F5DEB3'];

// Colori delle categorie M/F salvate; la CIE potrà correggerle dopo la verifica.
const getSexColor = (sesso: string) =>
  sesso === 'M' ? '#3b82f6' : sesso === 'F' ? '#ec4899' : '#9ca3af';

// Condivide lo swipe touch locale tra i grafici delle statistiche.
function useHorizontalChartTouchScroll() {
  const cleanupRef = useRef<(() => void) | null>(null);
  return useCallback((element: HTMLDivElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let gesture: 'horizontal' | 'vertical' | null = null;
    const handleStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture = 'vertical';
        return;
      }
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startScrollLeft = element.scrollLeft;
      gesture = null;
    };
    const handleMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;
      if (!gesture && Math.max(Math.abs(dx), Math.abs(dy)) >= 7) {
        gesture = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }
      if (gesture !== 'horizontal') return;

      // I gesti orizzontali restano nel grafico; il verticale rimane nativo.
      if (event.cancelable) event.preventDefault();
      element.scrollLeft = startScrollLeft - dx;
    };
    const handleEnd = () => { gesture = null; };
    element.addEventListener('touchstart', handleStart, { passive: true });
    element.addEventListener('touchmove', handleMove, { passive: false });
    element.addEventListener('touchend', handleEnd, { passive: true });
    element.addEventListener('touchcancel', handleEnd, { passive: true });
    cleanupRef.current = () => {
      element.removeEventListener('touchstart', handleStart);
      element.removeEventListener('touchmove', handleMove);
      element.removeEventListener('touchend', handleEnd);
      element.removeEventListener('touchcancel', handleEnd);
    };
  }, []);
}

export default function Utenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const {
    responseData,
    isLoadingUsers,
    isError,
    queryClient
  } = useUsers(user);

  const {
    searchTerm,
    setSearchTerm,
    selectedRuolo,
    selectedGradoElezione,
    sortState,
    paginationState,
    lastUpdateTime,
    updateSort,
    resetPagination,
    updateLastUpdateTime,
    setCurrentPage,
    handleRuoloChange,
    handleGradoElezioneChange
  } = useUserManagement();

  // Hook per rilevare se siamo su mobile
  const [isMobile, setIsMobile] = useState(false);

  // Calcola le statistiche direttamente dai dati degli utenti già caricati
  const stats = useMemo(() => {
    if (!responseData?.utenti) return null;
    
    const utenti = responseData.utenti;
    
    // Calcola distribuzioni per i grafici
    const usersByRole = utenti.reduce((acc, user) => {
      const role = user.ruolo || 'N/A';
      // Filtra il ruolo "Utente" che non esiste
      if (role === 'Utente') return acc;
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersBySesso = utenti.reduce((acc, user) => {
      // Solo persone: usa il campo M/F già salvato, anche se proveniente da dati storici.
      if (user.account_type !== 'PERSON' && user.account_type !== 'P') return acc;
      const sesso = user.sesso === 'M' || user.sesso === 'F'
        ? user.sesso
        : 'Non disponibile';
      acc[sesso] = (acc[sesso] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByCitizenship = utenti.reduce((acc, user) => {
      const citizenship = user.cittadinanza || user.paese_residenza || 'N/A';
      acc[citizenship] = (acc[citizenship] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByRegion = utenti.reduce((acc, user) => {
      const region = user.regione_residenza || 'N/A';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const usersByCity = utenti.reduce((acc, user) => {
      const city = user.comune_residenza || 'N/A';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // La residenza e il territorio elettorale sono informazioni distinte.
    // I profili politici importati possono avere un mandato ma non una residenza documentata.
    const hasDocumentedPlace = (value: unknown): value is string =>
      typeof value === 'string' && value.trim() !== '' && value.trim().toUpperCase() !== 'N/A';
    const usersWithKnownResidence = utenti.filter(user => hasDocumentedPlace(user.comune_residenza)).length;
    const politicians = utenti.filter(user => user.ruolo === 'P');

    // Per le statistiche indicative, usa il territorio elettorale solo se la
    // residenza non è disponibile. Non scrivere la stima nei campi personali.
    // Un'eventuale residenza dichiarata in futuro ha sempre precedenza.
    const usersByRegionWithEstimates = utenti.reduce((acc, user) => {
      const region = hasDocumentedPlace(user.regione_residenza)
        ? user.regione_residenza.trim()
        : user.ruolo === 'P' && hasDocumentedPlace(user.regione_elezione)
          ? user.regione_elezione.trim()
          : 'N/A';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const usersWithKnownRegion = utenti.filter(user => hasDocumentedPlace(user.regione_residenza)).length;
    const usersWithProvisionalRegion = politicians.filter(user =>
      !hasDocumentedPlace(user.regione_residenza) && hasDocumentedPlace(user.regione_elezione)
    ).length;

    // Il comune elettorale può essere indicativo soltanto per un incarico CO.
    // Non attribuire ai parlamentari un comune usando la circoscrizione.
    const usersByCityWithEstimates = utenti.reduce((acc, user) => {
      const city = hasDocumentedPlace(user.comune_residenza)
        ? user.comune_residenza.trim()
        : user.ruolo === 'P' && user.grado_elezione === 'CO' && hasDocumentedPlace(user.comune_elezione)
          ? user.comune_elezione.trim()
          : 'N/A';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const usersWithProvisionalMunicipality = politicians.filter(user =>
      !hasDocumentedPlace(user.comune_residenza) &&
      user.grado_elezione === 'CO' &&
      hasDocumentedPlace(user.comune_elezione)
    ).length;
    const politiciansByElectionRegion = politicians.reduce((acc, user) => {
      if (hasDocumentedPlace(user.regione_elezione)) {
        const region = user.regione_elezione.trim();
        acc[region] = (acc[region] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const politiciansByElectionMunicipality = politicians.reduce((acc, user) => {
      if (hasDocumentedPlace(user.comune_elezione)) {
        const municipality = user.comune_elezione.trim();
        acc[municipality] = (acc[municipality] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const politiciansWithElectionRegion = Object.values(politiciansByElectionRegion).reduce((sum, count) => sum + count, 0);
    const politiciansWithElectionMunicipality = Object.values(politiciansByElectionMunicipality).reduce((sum, count) => sum + count, 0);
    
    // Età: esclusivamente le date di nascita realmente registrate delle persone.
    // Niente dati fittizi o inferenze dai nomi dei politici / account importati.
    const usersByAge = utenti.reduce((acc, user) => {
      if (user.account_type !== 'PERSON' && user.account_type !== 'P') return acc;

      const dateText = typeof user.data_nascita === 'string'
        ? user.data_nascita
        : '';
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
      let ageGroup = 'N/A';

      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        const valid = year >= 1 &&
          date.getUTCFullYear() === year &&
          date.getUTCMonth() === month - 1 &&
          date.getUTCDate() === day;

        if (valid) {
          const today = new Date();
          let age = today.getFullYear() - year;
          if (today.getMonth() + 1 < month ||
            (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
          // Esclude anche placeholder implausibili (es. 1111-11-11).
          if (age >= 0 && age <= 125) {
            if (age < 18) ageGroup = 'Under 18';
            else if (age <= 25) ageGroup = '18-25';
            else if (age <= 35) ageGroup = '26-35';
            else if (age <= 45) ageGroup = '36-45';
            else if (age <= 55) ageGroup = '46-55';
            else if (age <= 65) ageGroup = '56-65';
            else ageGroup = '65+';
          }
        }
      }
      acc[ageGroup] = (acc[ageGroup] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers: utenti.length,
      usersByRole,
      usersBySesso,
      usersByCitizenship,
      usersByRegion,
      usersByCity,
      usersByRegionWithEstimates,
      usersWithKnownRegion,
      usersWithProvisionalRegion,
      usersByCityWithEstimates,
      usersWithProvisionalMunicipality,
      usersWithKnownResidence,
      politiciansCount: politicians.length,
      politiciansByElectionRegion,
      politiciansByElectionMunicipality,
      politiciansWithElectionRegion,
      politiciansWithElectionMunicipality,
      usersByAge
    };
  }, [responseData?.utenti]);
  
  const isLoadingStats = isLoadingUsers;
  const isErrorStats = isError;
  
  // Funzione per preparare i dati per i grafici a torta
  const preparePieData = (data: Record<string, number> | null | undefined) => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  };
  
  // Funzione per preparare i dati per il bar chart delle età
  const prepareAgeBarData = (data: Record<string, number> | null | undefined) => {
    if (!data) return [];
    const order = ['Under 18', '18-25', '26-35', '36-45', '46-55', '56-65', '65+', 'N/A'];
    return Object.entries(data)
      .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
      .map(([name, value]) => ({ name, value }));
  };
  
  // Le regioni sono ordinate per numero di utenti; N/A non è una regione.
  const prepareRegionBarData = (data: Record<string, number> | null | undefined) => {
    if (!data) return [];
    return Object.entries(data)
      .filter(([name]) => name.trim() !== '' && name.trim().toUpperCase() !== 'N/A')
      .sort(([nameA, countA], [nameB, countB]) =>
        countB - countA || nameA.localeCompare(nameB, 'it'))
      .map(([name, value]) => ({ name, value }));
  };
  const regionBarData = prepareRegionBarData(stats?.usersByRegionWithEstimates);

  const setRegionChartScrollRef = useHorizontalChartTouchScroll();
  const setRoleChartScrollRef = useHorizontalChartTouchScroll();
  const roleBarData = Object.entries(stats?.usersByRole ?? {})
    .sort(([nameA, countA], [nameB, countB]) =>
      countB - countA || nameA.localeCompare(nameB, 'it'))
    .map(([name, value]) => ({ name, value }));

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debug logging per capire il ruolo dell'utente
  useEffect(() => {
    console.log('🔍 DEBUG Utenti - Auth state:', {
      user: user ? { id: user.id, email: user.email, ruolo: user.ruolo } : null,
      isAuthLoading,
      userRole: user?.ruolo,
      userRuolo: user?.ruolo,
      isAdmin: hasAdminCapability(user)
    });
  }, [user, isAuthLoading]);

  // Funzione per pulire token vecchi e forzare nuovo login
  const clearInvalidToken = async () => {
    console.log('🔍 DEBUG Utenti - Pulizia token non valido');
    try {
      await forceTokenRefresh();
    } catch (error) {
      console.error('❌ Errore nella pulizia token:', error);
      clearAllTokens();
    }
  };

  // Hook per forzare il refresh quando la pagina diventa visibile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && hasAdminCapability(user)) {
        console.log('🔄 Pagina diventata visibile, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        updateLastUpdateTime();
      }
    };

    const handleFocus = () => {
      if (hasAdminCapability(user)) {
        console.log('🔄 Finestra riprende focus, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        updateLastUpdateTime();
      }
    };

    // Aggiungi event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, queryClient, updateLastUpdateTime]);

  // Controllo accesso
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAdminCapability(user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-red-200 page-with-navbar flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-red-700 mb-4">Accesso Negato</h2>
          <p className="text-lg text-gray-700">Non hai i permessi necessari per visualizzare questa pagina.</p>
          <p className="text-md text-gray-500 mt-2">Solo gli amministratori possono accedere.</p>
        </div>
      </div>
    );
  }

  // Preparazione dati
  const allUsers = responseData?.utenti || [];
  const displayColumns = getDisplayColumns(allUsers);

  // Calcola i valori disponibili per i filtri
  const availableRuoli = useMemo(() => {
    const ruoli = new Set<string>();
    allUsers.forEach((u: any) => {
      if (u.ruolo) {
        ruoli.add(u.ruolo);
      }
    });
    return Array.from(ruoli).sort();
  }, [allUsers]);

  const availableGradiElezione = useMemo(() => {
    const gradi = new Set<string>();
    allUsers.forEach((u: any) => {
      if (u.grado_elezione) {
        gradi.add(u.grado_elezione);
      }
    });
    return Array.from(gradi).sort();
  }, [allUsers]);

  // Filtraggio e ordinamento
  const filteredUsers = useMemo(() => {
    let filtered = allUsers.filter((u: any) => {
      // Filtro per ricerca testuale
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || (
        u.nome?.toLowerCase().includes(searchLower) ||
        u.cognome?.toLowerCase().includes(searchLower) ||
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.ruolo?.toLowerCase().includes(searchLower) ||
        `${u.nome} ${u.cognome}`.toLowerCase().includes(searchLower) ||
        u.nome_completo?.toLowerCase().includes(searchLower)
      );

      // Filtro per ruolo
      const matchesRuolo = selectedRuolo === "all" || u.ruolo === selectedRuolo;

      // Filtro per grado elezione
      const matchesGradoElezione = selectedGradoElezione === "all" || u.grado_elezione === selectedGradoElezione;

      return matchesSearch && matchesRuolo && matchesGradoElezione;
    });

    // Ordinamento
    filtered.sort((a: any, b: any) => {
      const aValue = a[sortState.sortField];
      const bValue = b[sortState.sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      const comparison = String(aValue).localeCompare(String(bValue), 'it');
      return sortState.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allUsers, searchTerm, selectedRuolo, selectedGradoElezione, sortState]);

  // Paginazione
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (paginationState.currentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

  // Aggiorna totalPages nel paginationState
  useEffect(() => {
    if (totalPages !== paginationState.totalPages) {
      // Reset alla prima pagina se il numero totale di pagine cambia
      if (paginationState.currentPage > totalPages) {
        setCurrentPage(1);
      }
    }
  }, [totalPages, paginationState.totalPages, paginationState.currentPage, setCurrentPage]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    queryClient.invalidateQueries({ queryKey: ['statisticheUtenti'] });
    updateLastUpdateTime();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-full px-4 py-4 md:px-6 md:py-6">
        {/* Header */}
        <Header />

        {/* Tabs per Gestisci e Statistiche */}
        <Tabs defaultValue="gestisci" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="gestisci" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Gestisci Utenti
            </TabsTrigger>
            <TabsTrigger value="statistiche" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistiche
            </TabsTrigger>
          </TabsList>

          {/* Scheda Gestisci Utenti */}
          <TabsContent value="gestisci" className="space-y-6">
            {/* Barra di ricerca */}
            <SearchBar 
              searchTerm={searchTerm}
              onSearchChange={(value) => {
                setSearchTerm(value);
                resetPagination();
              }}
            />

            {/* Filtri */}
            <FiltersBar
              selectedRuolo={selectedRuolo}
              selectedGradoElezione={selectedGradoElezione}
              onRuoloChange={handleRuoloChange}
              onGradoElezioneChange={handleGradoElezioneChange}
              availableRuoli={availableRuoli}
              availableGradiElezione={availableGradiElezione}
            />

            {/* Contenuto principale */}
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <span className="ml-3 text-lg text-gray-600">Caricamento utenti...</span>
              </div>
            ) : isError ? (
              <div className="text-center py-8 md:py-12 px-4">
                <AlertCircle className="h-12 w-12 md:h-16 md:w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Errore nel caricamento</h3>
                <p className="text-red-600 mb-4">Impossibile caricare gli utenti. Potrebbe essere un problema di autenticazione.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={handleRefresh}
                    variant="outline"
                    className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  >
                    Riprova
                  </Button>
                  <Button 
                    onClick={clearInvalidToken}
                    variant="outline"
                    className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    Nuovo Login
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Tabella utenti attivi */}
                <Card className="bg-white border-0 shadow-lg w-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center text-2xl text-gray-800">
                      <Users className="h-6 w-6 mr-3 text-blue-600" />
                      Tutti gli Utenti
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Consulta gli utenti della piattaforma. Le modifiche ai dati non sono disponibili in questa pagina.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isMobile ? (
                      <MobileUsersTable 
                        users={paginatedUsers}
                      />
                    ) : (
                      <UsersTable 
                        users={paginatedUsers}
                        displayColumns={displayColumns}
                        sortState={sortState}
                        onSort={updateSort}
                      />
                    )}
                    
                    {/* Paginazione */}
                    <Pagination 
                      currentPage={paginationState.currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Scheda Statistiche */}
          <TabsContent value="statistiche" className="space-y-6">
            {isLoadingStats && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <span className="ml-3 text-lg text-gray-600">Caricamento statistiche...</span>
              </div>
            )}
            
            {isErrorStats && (
              <div className="text-center py-8 md:py-12 px-4">
                <AlertCircle className="h-12 w-12 md:h-16 md:w-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-900 mb-2">Errore nel caricamento</h3>
                <p className="text-red-600 mb-4">Impossibile caricare le statistiche.</p>
                <Button 
                  onClick={handleRefresh}
                  variant="outline"
                  className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                >
                  Riprova
                </Button>
              </div>
            )}
            
            {stats && (
              <div className="space-y-8">
                <Card className="bg-white">
                  <CardHeader>
                    <CardTitle>Utenti Totali</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-primary">{stats.totalUsers}</div>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione per Ruolo</CardTitle>
                      <CardDescription>Dal ruolo più numeroso al meno numeroso.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Trascina il grafico con il dito verso destra o sinistra per vedere tutti i ruoli.
                      </p>
                      <div
                        ref={setRoleChartScrollRef}
                        data-testid="utenti-role-chart-scroll"
                        data-horizontal-swipe-region="true"
                        className="utenti-horizontal-chart-scroll w-full max-w-full overflow-x-auto pb-2"
                        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                        role="region"
                        aria-label="Grafico dei ruoli ordinato per numero di utenti: scorri orizzontalmente"
                        tabIndex={0}
                      >
                        <div className="h-[380px] w-full" style={{ minWidth: `${Math.max(640, roleBarData.length * 80)}px` }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roleBarData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" interval={0} height={52} tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" name="Utenti" fill="#3b82f6" maxBarSize={46} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione per sesso</CardTitle>
                      <CardDescription>Maschile e Femminile dai valori M/F presenti; la verifica CIE potrà aggiornarli.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={preparePieData(stats.usersBySesso)} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            fill="#8884d8" 
                            label
                          >
                            {preparePieData(stats.usersBySesso).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getSexColor(entry.name)} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione per Età</CardTitle>
                      <CardDescription>Solo persone, inclusi profili politici importati. Date presenti nel database, non necessariamente certificate; N/A se mancanti o implausibili.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={prepareAgeBarData(stats.usersByAge)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione per Cittadinanza</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={preparePieData(stats.usersByCitizenship)} 
                            dataKey="value" 
                            nameKey="name" 
                            cx="50%" 
                            cy="50%" 
                            outerRadius={80} 
                            fill="#8884d8" 
                            label
                          >
                            {preparePieData(stats.usersByCitizenship).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione geografica indicativa per regione</CardTitle>
                      <CardDescription>Residenza registrata; se mancante per un politico, regione elettorale usata come riferimento provvisorio, non come residenza certificata.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        Residenza registrata: {stats.usersWithKnownRegion}. Regione elettorale stimata: {stats.usersWithProvisionalRegion}.
                        Le stime non vengono salvate nel profilo e sono superate dalla residenza indicata dal politico.
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Regione non disponibile per {stats.usersByRegionWithEstimates['N/A'] ?? 0} {(stats.usersByRegionWithEstimates['N/A'] ?? 0) === 1 ? 'utente' : 'utenti'}.
                      </p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Trascina il grafico con il dito verso destra o sinistra per vedere tutte le regioni.
                      </p>
                      <div
                        ref={setRegionChartScrollRef}
                        data-testid="utenti-region-chart-scroll"
                        data-horizontal-swipe-region="true"
                        className="utenti-horizontal-chart-scroll w-full max-w-full overflow-x-auto pb-2"
                        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                        role="region"
                        aria-label="Grafico delle regioni ordinato per numero di utenti: scorri orizzontalmente"
                        tabIndex={0}
                      >
                        <div className="h-[380px] w-full" style={{ minWidth: `${Math.max(640, regionBarData.length * 72)}px` }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={regionBarData} margin={{ top: 12, right: 16, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" interval={0} angle={-48} textAnchor="end" height={125} tick={{ fontSize: 12 }} />
                              <YAxis allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" name="Utenti" fill="#3b82f6" maxBarSize={46} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Territori dei politici: mai usarli come sostituti della residenza. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Politici per regione di elezione</CardTitle>
                      <CardDescription>Territorio degli incarichi politici, non regione di residenza. Un mandato attivo ha precedenza sui dati elettorali storici.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">Regione indicata per {stats.politiciansWithElectionRegion} di {stats.politiciansCount} politici.</p>
                      {stats.politiciansWithElectionRegion > 0 ? (
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={preparePieData(stats.politiciansByElectionRegion)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {preparePieData(stats.politiciansByElectionRegion).map((entry, index) => (
                                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">Nessuna regione di elezione disponibile.</p>}
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Comuni indicati per l'elezione dei politici</CardTitle>
                      <CardDescription>Solo comuni espressamente riportati nei dati elettorali; per incarichi non comunali il campo può non essere applicabile.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">Comune indicato per {stats.politiciansWithElectionMunicipality} di {stats.politiciansCount} politici.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr><th className="p-2 text-left">Comune</th><th className="p-2 text-right">Politici</th></tr>
                          </thead>
                          <tbody>
                            {Object.entries(stats.politiciansByElectionMunicipality)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 10)
                              .map(([municipality, count]) => (
                                <tr key={municipality}>
                                  <td className="p-2">{municipality}</td>
                                  <td className="p-2 text-right">{count}</td>
                                </tr>
                              ))}
                            {stats.politiciansWithElectionMunicipality === 0 && (
                              <tr><td className="p-2 text-sm text-muted-foreground" colSpan={2}>Nessun comune elettorale disponibile.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Distribuzione per Età (Dettaglio)</CardTitle>
                      <CardDescription>Conteggi calcolati, senza dati inventati. N/A indica date mancanti, impossibili o implausibili.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="p-2 text-left">Fascia d'Età</th>
                              <th className="p-2 text-left">Numero Utenti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.usersByAge && Object.entries(stats.usersByAge)
                              .sort(([a], [b]) => {
                                const order = ['Under 18', '18-25', '26-35', '36-45', '46-55', '56-65', '65+', 'N/A'];
                                return order.indexOf(a) - order.indexOf(b);
                              })
                              .map(([ageGroup, count]) => (
                                <tr key={ageGroup}>
                                  <td className="p-2 font-medium">{ageGroup}</td>
                                  <td className="p-2">{count}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>I 10 comuni di residenza o riferimento comunale</CardTitle>
                      <CardDescription>Residenza registrata; in sua assenza, solo per politici comunali (CO), il comune di elezione viene contato come stima provvisoria.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">Residenza comunale disponibile per {stats.usersWithKnownResidence} di {stats.totalUsers} utenti; riferimenti comunali stimati: {stats.usersWithProvisionalMunicipality}.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="p-2 text-left">Comune</th>
                              <th className="p-2 text-left">Numero Utenti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.usersByCityWithEstimates && Object.entries(stats.usersByCityWithEstimates)
                              .filter(([city]) => city !== 'N/A' && city.trim() !== '')
                              .sort(([,a], [,b]) => b - a)
                              .slice(0, 10)
                              .map(([city, count]) => (
                                <tr key={city}>
                                  <td className="p-2 font-medium">{city}</td>
                                  <td className="p-2">{count}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
