import React from "react";
import { IniziativeTableProps } from "../types";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDisplayableDate } from "@/utils/dateUtils";

const MINISTERO_DETTAGLIO_BASE =
  "https://firmereferendum.giustizia.it/referendum/open/dettaglio-open";

function resolveFirmaUrl(iniziativa: {
  sitoWeb?: string;
  id_ministero?: string | number;
}): string | null {
  if (iniziativa.sitoWeb) return iniziativa.sitoWeb;
  if (iniziativa.id_ministero != null && iniziativa.id_ministero !== "") {
    return `${MINISTERO_DETTAGLIO_BASE}/${iniziativa.id_ministero}`;
  }
  return null;
}

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
    <div className="iniziative-popolari-grid">
      {listaIniziative.map((iniziativa) => {
        // Determina lo sfondo in base a firme_raccolte
        const getBackgroundClass = () => {
          if (iniziativa.quorum === 'proposta') {
            return 'border-blue-200 bg-blue-50';
          }
          
          const firmeRaccolte = iniziativa.firme_raccolte || iniziativa.firme || 0;
          
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

        const dataScadenza = getDisplayableDate(iniziativa.dataFine || iniziativa.data_fine);
        const firmaUrl = resolveFirmaUrl(iniziativa);

        return (
          <div 
            key={iniziativa.id} 
            className={`${getBackgroundClass()} iniziative-popolari-card border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
            onClick={() => onView && onView(iniziativa)}
          >
          <div className="flex flex-col items-center text-center">
            {/* Emoji sopra il titolo */}
            {iniziativa.emoji && (
              <div className="mb-2">
                <span className="text-4xl" role="img" aria-label="emoji">
                  {iniziativa.emoji}
                </span>
              </div>
            )}
            
            {/* Titolo centrato */}
            <div className="mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {iniziativa.nome}
              </h3>
              {iniziativa.quorum === 'proposta' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                  Proposta
                </span>
              )}
            </div>
              
            {/* Informazioni centrate */}
            <div className="flex flex-col items-center gap-2 text-sm text-gray-500 mt-3">
              <span>
                Firme raccolte: <strong>
                  {iniziativa.nome === "BASTA QUORUM PER I REFERENDUM! CHI VOTA DECIDE." 
                    ? "71.066" 
                    : (iniziativa.firme || 0).toLocaleString('it-IT')
                  }
                </strong>
              </span>
              {dataScadenza && (
                <span>
                  Scadenza: <strong>
                    {new Date(dataScadenza).toLocaleDateString('it-IT')}
                  </strong>
                </span>
              )}
            </div>
              
            {/* Barra di completamento */}
            {(() => {
              const firmeRaccolte = iniziativa.nome === "BASTA QUORUM PER I REFERENDUM! CHI VOTA DECIDE." 
                ? 71066 
                : (iniziativa.firme_raccolte || iniziativa.firme || 0);
              const totaleMinimo = 50000;
              const percentuale = Math.min((firmeRaccolte / totaleMinimo) * 100, 100);
              const haSuperatoQuorum = firmeRaccolte >= totaleMinimo;
              
              return (
                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                    <span>Progresso verso il quorum (50.000 firme)</span>
                    <span className="font-semibold">{percentuale.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        haSuperatoQuorum 
                          ? 'bg-green-500' 
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${percentuale}%` }}
                    />
                  </div>
                </div>
              );
            })()}
              
            {/* Pulsante Firma sotto la barra di completamento */}
            {firmaUrl && (
              <div className="mt-4 flex justify-center">
                <a
                  href={firmaUrl.startsWith('http') ? firmaUrl : `https://${firmaUrl}`}
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
              </div>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
};
