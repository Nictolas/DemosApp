import React from "react";
import { IniziativeTableProps } from "../types";
import { Loader2, ExternalLink } from "lucide-react";

export const IniziativeTable: React.FC<IniziativeTableProps> = ({ 
  listaIniziative, 
  mieiVoti, 
  isLoading, 
  isError, 
  onView 
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 p-4">
        Errore nel caricamento delle iniziative popolari.
      </div>
    );
  }

  if (listaIniziative.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessuna iniziativa popolare disponibile.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listaIniziative.map((iniziativa) => (
        <div 
          key={iniziativa.id} 
          className={`bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
            iniziativa.quorum === 'proposta'
              ? 'border-blue-200 bg-blue-50'
              : 'border-gray-200'
          }`}
          onClick={() => onView && onView(iniziativa)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={
                    iniziativa.quorum === 'ok'
                      ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-green-500 flex-shrink-0'
                      : iniziativa.quorum === 'pending'
                        ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-yellow-500 flex-shrink-0'
                        : iniziativa.quorum === 'no'
                          ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-red-500 flex-shrink-0'
                          : iniziativa.quorum === 'proposta'
                            ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-blue-500 flex-shrink-0'
                            : 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-gray-400 flex-shrink-0'
                  }
                  aria-hidden="true"
                />
                <h3 className="text-lg font-semibold text-gray-900">
                  {iniziativa.nome}
                </h3>
                {iniziativa.quorum === 'proposta' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Proposta
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-3">
                <span>
                  Firme raccolte: <strong>
                    {iniziativa.nome === "BASTA QUORUM PER I REFERENDUM! CHI VOTA DECIDE." 
                      ? "71.066" 
                      : (iniziativa.firme || 0).toLocaleString('it-IT')
                    }
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
