import React from "react";
import { Loader2, Check, Hourglass, X as XIcon } from "lucide-react";
import { ICETableProps } from "../types";

export const ICETable: React.FC<ICETableProps> = ({
  listaICE,
  mieiVoti,
  isLoading,
  isError,
  onView
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-red-600">
        Errore nel caricamento delle ICE
      </div>
    );
  }

  if (listaICE.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessuna ICE trovata
      </div>
    );
  }

  const getQuorumStatus = (quorum: string) => {
    switch (quorum) {
      case 'ok':
        return { icon: <Check className="h-4 w-4 text-green-600" />, text: 'Raggiunto', color: 'text-green-600' };
      case 'pending':
        return { icon: <Hourglass className="h-4 w-4 text-yellow-500" />, text: 'In corso', color: 'text-yellow-500' };
      case 'no':
        return { icon: <XIcon className="h-4 w-4 text-red-600" />, text: 'Non raggiunto', color: 'text-red-600' };
      default:
        return { icon: null, text: quorum, color: 'text-gray-600' };
    }
  };

  return (
    <div className="space-y-4">
      {listaICE.map((ice) => {
        const quorumStatus = getQuorumStatus(ice.quorum);
        const hasVoted = mieiVoti.includes(ice.id);
        
        return (
          <div key={ice.id} className={`bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow ${
            ice.status === 'proposta' 
              ? 'border-blue-200 bg-blue-50' 
              : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={
                    ice.quorum === 'ok'
                      ? 'inline-block w-3 h-3 rounded-full bg-green-500'
                      : ice.quorum === 'pending'
                        ? 'inline-block w-3 h-3 rounded-full bg-yellow-500'
                        : ice.quorum === 'no'
                          ? 'inline-block w-3 h-3 rounded-full bg-red-500'
                          : 'inline-block w-3 h-3 rounded-full bg-gray-400'
                  }
                  aria-hidden="true"
                />
                <span
                  className={
                    ice.esito === 'Attuata'
                      ? 'inline-block w-3 h-3 rounded-full bg-green-500'
                      : ice.esito === 'In Attesa'
                      ? 'inline-block w-3 h-3 rounded-full bg-yellow-500'
                      : ice.esito === 'Non Accolta'
                      ? 'inline-block w-3 h-3 rounded-full bg-red-500'
                      : 'inline-block w-3 h-3 rounded-full bg-gray-300'
                  }
                  aria-hidden="true"
                />
                {ice.status === 'proposta' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Proposta
                  </span>
                )}
                {onView ? (
                  <button
                    className="text-blue-700 underline hover:text-blue-900 cursor-pointer text-lg font-medium"
                    onClick={() => onView(ice)}
                  >
                    {ice.nome}
                  </button>
                ) : (
                  <span className="text-lg font-medium">{ice.nome}</span>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Firme raccolte</div>
                <div className="text-xl font-bold text-gray-800">
                  {ice.firme ? ice.firme.toLocaleString('it-IT') : '0'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
