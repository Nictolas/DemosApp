import React, { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { UserAutocomplete } from "@/components/UserAutocomplete";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  nome: string;
  cognome: string;
  displayName: string;
}

interface ModificaMinistroDialogProps {
  isOpen: boolean;
  onClose: () => void;
  ruoloMinistro: string;
  currentUser?: {
    id: string;
    nome: string;
    cognome: string;
    email: string;
  } | null;
  onSuccess: () => void;
}

export const ModificaMinistroDialog: React.FC<ModificaMinistroDialogProps> = ({
  isOpen,
  onClose,
  ruoloMinistro,
  currentUser,
  onSuccess
}) => {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(
    currentUser ? {
      id: currentUser.id,
      nome: currentUser.nome,
      cognome: currentUser.cognome,
      displayName: `${currentUser.nome} ${currentUser.cognome}`
    } : null
  );
  const [searchValue, setSearchValue] = useState(
    currentUser ? `${currentUser.nome} ${currentUser.cognome}` : ""
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
  };

  const handleSave = async () => {
    if (!selectedUser) {
      toast({
        title: "Errore",
        description: "Seleziona un utente dalla piattaforma",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiRequest(
        "PUT",
        `/api/governo/attuale/${encodeURIComponent(ruoloMinistro)}`,
        { user_id: selectedUser.id }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel salvare il ministro");
      }

      toast({
        title: "Successo",
        description: "Ministro aggiornato con successo"
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvare il ministro",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest(
        "PUT",
        `/api/governo/attuale/${encodeURIComponent(ruoloMinistro)}`,
        { user_id: null }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel rimuovere il ministro");
      }

      toast({
        title: "Successo",
        description: "Ministro rimosso con successo"
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore nel rimuovere il ministro",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <h2 className="text-2xl font-bold">Modifica Ministro</h2>
          <p className="text-white text-opacity-90 mt-1">{ruoloMinistro}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleziona utente dalla piattaforma
            </label>
            <UserAutocomplete
              value={searchValue}
              onChange={setSearchValue}
              onUserSelect={handleUserSelect}
              placeholder="Cerca utente per nome..."
              className="w-full"
            />
            {selectedUser && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">
                  Utente selezionato:
                </p>
                <p className="text-sm text-gray-700">
                  {selectedUser.displayName}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!selectedUser || isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center space-x-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <span>Salva</span>
              )}
            </button>
            {currentUser && (
              <button
                onClick={handleRemove}
                disabled={isSaving}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Rimuovi
              </button>
            )}
            <button
              onClick={onClose}
              disabled={isSaving}
              className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-800 font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

