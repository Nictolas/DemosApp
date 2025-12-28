import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth-neon";
import { Loader2 } from "lucide-react";
import { MinistroAttualeCard } from "./MinistroAttualeCard";
import { ModificaMinistroDialog } from "./ModificaMinistroDialog";
import { ministriAttuali } from "../constants/ministri-attuali";
import { useGovernoData } from "../hooks/useGovernoData";
import { useGovernoActions } from "../hooks/useGovernoActions";

export const GovernoAttualeSection: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingRuolo, setEditingRuolo] = useState<string | null>(null);

  const isAdmin = user?.ruolo === "A" || user?.ruolo === "AD" || user?.ruolo === "Admin";

  // Query per ottenere i ministri attuali
  const { data, isLoading, isError } = useQuery({
    queryKey: ["governo-attuale"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/governo/attuale");
      if (!response.ok) throw new Error("Errore nel caricamento del governo attuale");
      const result = await response.json();
      return result.data || [];
    },
    staleTime: 30000, // Cache per 30 secondi
  });

  // Dati dei voti per i ministeri
  const { data: votiData } = useGovernoData(user);
  const { handleNavigateToMinistero } = useGovernoActions();

  const handleEdit = (ruolo: string) => {
    setEditingRuolo(ruolo);
  };

  const handleCloseDialog = () => {
    setEditingRuolo(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["governo-attuale"] });
  };

  // Crea una mappa per accesso rapido ai ministri per ruolo
  const ministriMap = new Map(
    (data || []).map((m: any) => [m.ruolo_ministro, m])
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-red-600">Errore nel caricamento del governo attuale</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Governo Attuale</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ministriAttuali.map((ruolo) => {
          const ministro = ministriMap.get(ruolo) || null;
          return (
            <MinistroAttualeCard
              key={ruolo}
              ruoloMinistro={ruolo}
              ministro={ministro}
              votiData={votiData}
              isAdmin={isAdmin}
              onEdit={() => handleEdit(ruolo)}
              onNavigate={handleNavigateToMinistero}
            />
          );
        })}
      </div>

      {/* Dialog per modificare il ministro */}
      {editingRuolo && (
        <ModificaMinistroDialog
          isOpen={!!editingRuolo}
          onClose={handleCloseDialog}
          ruoloMinistro={editingRuolo}
          currentUser={
            ministriMap.get(editingRuolo)
              ? {
                  id: ministriMap.get(editingRuolo)!.user_id || "",
                  nome: ministriMap.get(editingRuolo)!.nome_utente || "",
                  cognome: ministriMap.get(editingRuolo)!.cognome_utente || "",
                  email: ministriMap.get(editingRuolo)!.email_utente || ""
                }
              : null
          }
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

