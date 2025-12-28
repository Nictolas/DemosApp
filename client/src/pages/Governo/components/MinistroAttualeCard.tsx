import React from "react";
import { Edit3, User } from "lucide-react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

interface MinistroAttualeCardProps {
  ruoloMinistro: string;
  ministro?: {
    id: string;
    user_id: string | null;
    nome_utente: string | null;
    cognome_utente: string | null;
    email_utente: string | null;
    avatar_config?: any;
  } | null;
  isAdmin: boolean;
  onEdit: () => void;
}

export const MinistroAttualeCard: React.FC<MinistroAttualeCardProps> = ({
  ruoloMinistro,
  ministro,
  isAdmin,
  onEdit
}) => {
  const hasMinistro = ministro && ministro.user_id;
  const nomeCompleto = ministro && ministro.nome_utente && ministro.cognome_utente
    ? `${ministro.nome_utente} ${ministro.cognome_utente}`
    : null;

  // Parse avatar_config se è una stringa
  let avatarConfig = null;
  if (ministro?.avatar_config) {
    try {
      if (typeof ministro.avatar_config === 'string') {
        avatarConfig = JSON.parse(ministro.avatar_config);
        // Se il risultato è ancora una stringa, fai un secondo parse
        if (typeof avatarConfig === 'string') {
          avatarConfig = JSON.parse(avatarConfig);
        }
      } else {
        avatarConfig = ministro.avatar_config;
      }
    } catch (e) {
      console.error('Errore nel parsing avatar_config:', e);
      avatarConfig = null;
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow" style={{ backgroundColor: 'white' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            {ruoloMinistro}
          </h3>
          {hasMinistro ? (
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {avatarConfig ? (
                  <CustomAvatar 
                    config={avatarConfig} 
                    size={48} 
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>
              {/* Info utente */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {nomeCompleto}
                </p>
                {ministro.email_utente && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {ministro.email_utente}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">
              Nessun ministro assegnato
            </div>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onEdit}
            className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Modifica ministro"
          >
            <Edit3 className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

