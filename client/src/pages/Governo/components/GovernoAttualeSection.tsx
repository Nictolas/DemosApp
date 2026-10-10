import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { MinistroAttualeCard } from "./MinistroAttualeCard";
import { ModificaMinistroDialog } from "./ModificaMinistroDialog";
import { EditUserAvatarDialog } from "@/components/EditUserAvatarDialog";
import { ministriAttuali } from "../constants/ministri-attuali";
import { useGovernoData } from "../hooks/useGovernoData";
import { useGovernoActions } from "../hooks/useGovernoActions";

interface MinistroAttualeRecord {
  id: string;
  ruolo_ministro: string;
  user_id: string | null;
  nome_utente: string | null;
  cognome_utente: string | null;
  email_utente: string | null;
  avatar_config?: unknown;
}

export const GovernoAttualeSection: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingRuolo, setEditingRuolo] = useState<string | null>(null);
  const [showEditAvatarDialog, setShowEditAvatarDialog] = useState(false);
  const [userForAvatarEdit, setUserForAvatarEdit] = useState<{
    id: string;
    nome: string;
    cognome: string;
    avatar_config?: any;
  } | null>(null);

  const isAdmin = user?.ruolo === "A" || user?.ruolo === "AD" || user?.ruolo === "Admin";
  const isAdminAD = user?.ruolo === "AD";

  // Query per ottenere i ministri attuali
  const { data, isLoading, isError } = useQuery<MinistroAttualeRecord[]>({
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

  const handleEditAvatar = (ministro: any) => {
    if (ministro && ministro.user_id) {
      setUserForAvatarEdit({
        id: ministro.user_id,
        nome: ministro.nome_utente || "",
        cognome: ministro.cognome_utente || "",
        avatar_config: ministro.avatar_config
      });
      setShowEditAvatarDialog(true);
    }
  };

  const handleAvatarUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["governo-attuale"] });
    setUserForAvatarEdit(null);
  };

  // Crea una mappa per accesso rapido ai ministri per ruolo
  const ministriMap = new Map(
    (data || []).map((m) => [m.ruolo_ministro, m] as const)
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
              isAdminAD={isAdminAD}
              onEdit={() => handleEdit(ruolo)}
              onEditAvatar={() => ministro && handleEditAvatar(ministro)}
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

      {/* Dialog per modifica avatar */}
      {userForAvatarEdit && (
        <EditUserAvatarDialog
          open={showEditAvatarDialog}
          onOpenChange={setShowEditAvatarDialog}
          userId={userForAvatarEdit.id}
          userName={[userForAvatarEdit.nome, userForAvatarEdit.cognome].filter(Boolean).join(' ') || 'N/A'}
          currentAvatarConfig={userForAvatarEdit.avatar_config}
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
    </div>
  );
};

