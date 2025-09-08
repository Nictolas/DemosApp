import React from "react";
import { useLocation } from "wouter";
import { X, Edit3 } from "lucide-react";
import { colorMap } from "../constants/ministeri";
import { MinisteroModalProps } from "../types";

export const MinisteroModal: React.FC<MinisteroModalProps> = ({
  ministero,
  data,
  isOpen,
  onClose
}) => {
  const [, setLocation] = useLocation();
  const IconComponent = ministero.icon;

  const handleModifica = () => {
    setLocation(`/governo/${ministero.slug}`);
    onClose();
  };

  const color = colorMap[ministero.color as keyof typeof colorMap] || colorMap.blue;

  // Ottieni i dati per questo ministero
  const classifiche = data?.classifiche?.[ministero.categoria] || [];
  const mioVoto = data?.mieiVoti?.[ministero.categoria];
  
  const piuVotato = classifiche.length > 0 ? classifiche[0] : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div 
          className="relative p-6 text-white rounded-t-2xl"
          style={{ background: `linear-gradient(135deg, ${color.bg} 0%, ${color.bg}dd 100%)` }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-4">
            <IconComponent className="h-12 w-12" style={{ color: color.icon }} />
            <div>
              <h2 className="text-2xl font-bold">{ministero.nome}</h2>
              <p className="text-white text-opacity-90">Informazioni e voti</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Il Più Votato */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Il Più Votato</h3>
            <div className="text-gray-600">
              {piuVotato ? (
                <div>
                  <div className="font-medium text-gray-900">{piuVotato.nome}</div>
                  <div className="text-sm text-gray-500">{piuVotato.voti} voti</div>
                </div>
              ) : (
                <div className="text-gray-500">Nessun voto ancora</div>
              )}
            </div>
          </div>

          {/* Il Tuo Voto */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Il Tuo Voto</h3>
            <div className="text-gray-600">
              {mioVoto ? (
                <div>
                  <div className="font-medium text-gray-900">{mioVoto}</div>
                  <div className="text-sm text-gray-500">Voto registrato</div>
                </div>
              ) : (
                <div className="text-gray-500">Non hai ancora votato</div>
              )}
            </div>
          </div>

          {/* Pulsante Modifica */}
          <button
            onClick={handleModifica}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <Edit3 className="h-5 w-5" />
            <span>Modifica Voto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
