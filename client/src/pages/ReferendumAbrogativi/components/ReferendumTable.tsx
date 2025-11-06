import React from "react";
import { ReferendumTableProps } from "../types";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      {listaReferendum.map((referendum) => {
        // Determina lo sfondo in base a firme_raccolte
        const getBackgroundClass = () => {
          if (referendum.quorum === 'proposta') {
            return 'border-blue-200 bg-blue-50';
          }
          
          const firmeRaccolte = referendum.firme_raccolte || referendum.firme || 0;
          
          // Verde opaco se firme_raccolte > 50000
          if (firmeRaccolte > 50000) {
            return 'border-gray-200 bg-green-50';
          }
          // Giallo opaco se firme_raccolte <= 49999
          if (firmeRaccolte <= 49999) {
            return 'border-gray-200 bg-yellow-50';
          }
          // Default
          return 'border-gray-200 bg-white';
        };

        return (
          <div 
            key={referendum.id} 
            className={`${getBackgroundClass()} border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
            onClick={() => onView && onView(referendum)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">
                    {referendum.nome}
                  </h3>
                  {referendum.quorum === 'proposta' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Proposta
                    </span>
                  )}
                  {referendum.sitoWeb && (
                    <a
                      href={referendum.sitoWeb.startsWith('http') ? referendum.sitoWeb : `https://${referendum.sitoWeb}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button 
                        variant="default" 
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Firma
                      </Button>
                    </a>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-3">
                  <span>
                    Firme raccolte: <strong>{(referendum.firme || 0).toLocaleString('it-IT')}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};