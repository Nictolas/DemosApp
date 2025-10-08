import React from "react";
import { ReferendumTableProps } from "../types";
import { Loader2, ExternalLink } from "lucide-react";

export const ReferendumTable: React.FC<ReferendumTableProps> = ({ 
  listaReferendum, 
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
        Errore nel caricamento dei referendum abrogativi.
      </div>
    );
  }

  if (listaReferendum.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessun referendum abrogativo disponibile.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {listaReferendum.map((referendum) => (
        <div 
          key={referendum.id} 
          className={`bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow ${
            referendum.quorum === 'proposta'
              ? 'border-blue-200 bg-blue-50'
              : 'border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span
                  className={
                    referendum.quorum === 'ok'
                      ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-green-500 flex-shrink-0'
                      : referendum.quorum === 'pending'
                        ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-yellow-500 flex-shrink-0'
                        : referendum.quorum === 'no'
                          ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-red-500 flex-shrink-0'
                          : referendum.quorum === 'proposta'
                            ? 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-blue-500 flex-shrink-0'
                            : 'inline-block w-3 h-3 min-w-[12px] min-h-[12px] rounded-full bg-gray-400 flex-shrink-0'
                  }
                  aria-hidden="true"
                />
                {onView ? (
                  <button
                    className="text-blue-700 underline hover:text-blue-900 cursor-pointer text-lg font-semibold"
                    onClick={() => onView(referendum)}
                  >
                    {referendum.nome}
                  </button>
                ) : (
                  <h3 className="text-lg font-semibold text-gray-900">
                    {referendum.nome}
                  </h3>
                )}
                {referendum.quorum === 'proposta' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Proposta
                  </span>
                )}
              </div>
              
              <p className="text-gray-600 mb-3 line-clamp-2">
                {referendum.descrizione}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>
                  Firme raccolte: <strong>{referendum.firme || 0}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};