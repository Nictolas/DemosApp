import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageTransition } from "@/components/PageTransition";
import { CustomAvatar } from "@/components/CustomAvatar";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { apiRequest } from "@/lib/queryClient";

interface RappresentanteInfo {
  nome: string;
  cognome: string;
  avatar_config?: string;
}

interface RappresentantiData {
  rappresentanti: Record<string, RappresentanteInfo>; // Es: { europeo: {...}, camera: {...} }
  idMap: Record<string, string>; // Es: { europeo: 'uid123', camera: 'uid456' }
}

export default function Rappresentanti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [opinioniDialogData, setOpinioniDialogData] = useState<{utenteId: string, nome: string, cognome: string, avatarConfig?: string, categoria?: string} | null>(null);
  const [showCambiaModal, setShowCambiaModal] = useState<{categoria: string | null} | false>(false);

  // 1. Caricamento dati con React Query
  const { data, isLoading, isError } = useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Utente non autenticato");
      // Unico endpoint per caricare tutti i rappresentanti dell'utente
      const response = await apiRequest("GET", `/api/rappresentanti/utente`);
      if (!response.ok) throw new Error("Errore nel caricamento dei rappresentanti");
      return response.json();
    },
    enabled: !!user,
  });

  if (isAuthLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }

  const categorie = [
    { id: "europeo", nome: "Parlamento Europeo", color: "blue" },
    { id: "camera", nome: "Camera dei Deputati", color: "green" },
    { id: "senato", nome: "Senato della Repubblica", color: "purple" },
    { id: "regione", nome: "Consiglio Regionale", color: "orange" },
    { id: "comune", nome: "Consiglio Comunale", color: "teal" }
  ];

  const renderRappresentante = (categoriaId: string) => {
    const rappresentanteData = data?.rappresentanti[categoriaId];
    const rappresentanteUid = data?.idMap[categoriaId];

    let avatarContent;
    if (rappresentanteData?.avatar_config) {
      try {
        const config = JSON.parse(rappresentanteData.avatar_config);
        avatarContent = <CustomAvatar config={config} size={80} className="w-full h-full" />;
      } catch (e) { /* Fallback to default */ }
    }

    return (
      <div className="flex flex-col space-y-3 items-center">
        <div className="h-20 w-20 border-2 border-gray-300 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {avatarContent || <User className="h-10 w-10 text-gray-400" />}
        </div>
        <div className="text-center">
          {rappresentanteData ? (
            <p className="font-medium text-primary cursor-pointer hover:underline" onClick={(e) => {
                e.stopPropagation(); // Previeni l'apertura del modal di cambio
                setOpinioniDialogData({ utenteId: rappresentanteUid!, nome: rappresentanteData.nome, cognome: rappresentanteData.cognome, avatarConfig: rappresentanteData.avatar_config, categoria: categoriaId });
            }}>
              {`${rappresentanteData.nome} ${rappresentanteData.cognome}`}
            </p>
          ) : (
            <p className="text-gray-500 italic">Nessuno scelto</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col overflow-hidden" style={{ paddingBottom: '80px' }}>
        <div className="container mx-auto px-4 py-8">
          <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>

          {isLoading ? (
            <div className="flex items-center justify-center pt-16"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : isError ? (
            <Card className="p-8 text-center"><CardContent><h2 className="text-xl font-semibold text-red-600">Errore nel caricamento</h2><p>Impossibile caricare i tuoi rappresentanti.</p></CardContent></Card>
          ) : (
            <>
              {/* Card Parlamento Europeo */}
              {(() => {
                const categoria = categorie[0];
                return (
                  <div className="relative w-full rounded-2xl shadow-lg overflow-hidden mb-4 cursor-pointer" onClick={() => setShowCambiaModal({ categoria: categoria.id })}>
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="100,0 0,0 0,35 100,20" fill="#dbeafe" /><polygon points="100,20 0,35 0,100 100,100" fill="#fff" /></svg>
                    <div className="relative z-10 p-6 flex flex-col items-center justify-center">
                      <User className="h-12 w-12 text-blue-600 mb-2" />
                      <div className="text-2xl font-bold text-blue-800 mb-1">{categoria.nome}</div>
                      {renderRappresentante(categoria.id)}
                    </div>
                  </div>
                );
              })()}
              {/* Altre card */}
              <div className="grid grid-cols-2 gap-2 pb-2">
                {categorie.slice(1).map((categoria) => {
                  const colorMap = { green: "#bbf7d0", purple: "#ede9fe", orange: "#fef9c3", teal: "#a7f3d0" };
                  const color = colorMap[categoria.color as keyof typeof colorMap];
                  return (
                    <div key={categoria.id} className="relative w-full rounded-2xl shadow-lg overflow-hidden cursor-pointer" onClick={() => setShowCambiaModal({ categoria: categoria.id })}>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="100,0 0,0 0,35 100,20" fill={color} /><polygon points="100,20 0,35 0,100 100,100" fill="#fff" /></svg>
                      <div className="relative z-10 p-4 md:p-6 flex flex-col items-center justify-center">
                        <User className={`h-8 md:h-12 w-8 md:w-12 mb-2 text-${categoria.color}-600`} />
                        <div className={`text-base md:text-xl font-bold mb-1 text-center leading-tight text-${categoria.color}-800`}>{categoria.nome}</div>
                        {renderRappresentante(categoria.id)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <ViewOpinioniDialog
          open={!!opinioniDialogData} onOpenChange={(open) => !open && setOpinioniDialogData(null)}
          utenteId={opinioniDialogData?.utenteId || ''}
          nome={opinioniDialogData?.nome} cognome={opinioniDialogData?.cognome}
          avatarConfig={opinioniDialogData?.avatarConfig} categoria={opinioniDialogData?.categoria as any}
        />
        {showCambiaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={() => setShowCambiaModal(false)}>
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xs flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4 text-center">Come vuoi scegliere il rappresentante?</h2>
              <Button className="w-full mb-2" onClick={() => showCambiaModal && setLocation(`/scegli-rappresentante/${showCambiaModal.categoria}`)}>Per Compatibilità di Idee</Button>
              <Button className="w-full" variant="outline" disabled>Per Merito (Prossimamente)</Button>
              <Button className="w-full mt-4" variant="ghost" onClick={() => setShowCambiaModal(false)}>Annulla</Button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}