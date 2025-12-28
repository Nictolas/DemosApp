import React from "react";
import { Edit3, User } from "lucide-react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { colorMap } from "../constants/ministeri";
import { ruoloToCategoria, ruoloToColor } from "../constants/ruolo-to-categoria";
import { ruoloToEmoji } from "../constants/ministri-attuali";
import { Ministero } from "../types";
import { ministeri } from "../constants/ministeri";

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
  votiData?: {
    classifiche?: Record<string, Array<{ nome: string; voti: number }>>;
    mieiVoti?: Record<string, string>;
  };
  isAdmin: boolean;
  onEdit: () => void;
  onNavigate: (ministero: Ministero) => void;
}

export const MinistroAttualeCard: React.FC<MinistroAttualeCardProps> = ({
  ruoloMinistro,
  ministro,
  votiData,
  isAdmin,
  onEdit,
  onNavigate
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

  // Ottieni categoria, colore e emoji per questo ruolo
  const categoria = ruoloToCategoria[ruoloMinistro] || "";
  const colorKey = ruoloToColor[ruoloMinistro] || "blue";
  const color = colorMap[colorKey as keyof typeof colorMap] || colorMap.blue;
  const emoji = ruoloToEmoji[ruoloMinistro] || "🏛️";

  // Ottieni i dati dei voti per questo ministero
  const classifiche = votiData?.classifiche?.[categoria] || [];
  const mioVoto = votiData?.mieiVoti?.[categoria];
  const piuVotato = classifiche.length > 0 ? classifiche[0] : null;

  // Trova il ministero corrispondente dalla lista
  const handleModificaVoto = () => {
    if (categoria) {
      // Cerca il ministero corrispondente nella lista
      const ministero = ministeri.find(m => m.categoria === categoria);
      if (ministero) {
        onNavigate(ministero);
      } else {
        // Fallback: crea un ministero minimo per la navigazione
        const fallbackMinistero: Ministero = {
          id: categoria,
          nome: ruoloMinistro,
          categoria: categoria,
          icon: User,
          color: colorKey,
          slug: categoria.replace(/_/g, '-')
        };
        onNavigate(fallbackMinistero);
      }
    }
  };

  return (
    <div 
      className="rounded-xl shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow"
      style={{ backgroundColor: 'white' }}
    >
      {/* Header con colore */}
      <div 
        className="relative -m-4 mb-4 p-4 text-white rounded-t-xl"
        style={{ background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)` }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span>{ruoloMinistro}</span>
        </h3>
      </div>

      <div className="space-y-4">
        {/* Avatar e info ministro */}
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
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400 italic">
              Nessun ministro assegnato
            </div>
            {isAdmin && (
              <button
                onClick={onEdit}
                className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Aggiungi ministro"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Il Più Votato */}
        <div className="bg-gray-50 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-gray-800 mb-2">Il Più Votato</h4>
          <div className="text-gray-600">
            {piuVotato ? (
              <div>
                <div className="text-sm font-medium text-gray-900">{piuVotato.nome}</div>
                <div className="text-xs text-gray-500">{piuVotato.voti} voti</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Nessun voto ancora</div>
            )}
          </div>
        </div>

        {/* Il Tuo Voto */}
        <div className="bg-blue-50 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-gray-800 mb-2">Il Tuo Voto</h4>
          <div className="text-gray-600">
            {mioVoto ? (
              <div>
                <div className="text-sm font-medium text-gray-900 mb-2">{mioVoto}</div>
                <div className="text-xs text-gray-500 mb-3">Voto registrato</div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 mb-3">Non hai ancora votato</div>
            )}
          </div>
          {/* Pulsante Modifica Voto dentro Il Tuo Voto */}
          <button
            onClick={handleModificaVoto}
            className="w-full text-white font-semibold py-2 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2 text-sm"
            style={{ backgroundColor: color.bg }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            <Edit3 className="h-4 w-4" />
            <span>Modifica Voto</span>
          </button>
        </div>
      </div>
    </div>
  );
};

