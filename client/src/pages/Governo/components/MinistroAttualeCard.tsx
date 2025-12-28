import React from "react";
import { Edit3, User } from "lucide-react";

interface MinistroAttualeCardProps {
  ruoloMinistro: string;
  ministro?: {
    id: string;
    user_id: string | null;
    nome_utente: string | null;
    cognome_utente: string | null;
    email_utente: string | null;
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

  return (
    <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            {ruoloMinistro}
          </h3>
          {hasMinistro ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <User className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {nomeCompleto}
                </p>
                {ministro.email_utente && (
                  <p className="text-xs text-gray-500 mt-1">
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
            className="ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Modifica ministro"
          >
            <Edit3 className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

