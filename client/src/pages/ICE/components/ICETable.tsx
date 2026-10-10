import React from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICETableProps } from "../types";

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("it-IT");
};

const normalizeUrl = (value?: string | null) => {
  if (!value) return null;
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
};

export const ICETable: React.FC<ICETableProps> = ({ listaICE, isLoading, isError }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-10 text-red-600">
        Impossibile caricare le ICE ufficiali in questo momento.
      </div>
    );
  }

  if (listaICE.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Nessuna ICE ufficiale risulta attualmente in raccolta firme.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {listaICE.map((ice) => {
        const officialUrl = normalizeUrl(ice.sitoWeb);
        const endDate = formatDate(ice.dataFine);

        return (
          <article key={ice.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{ice.nome}</h2>
              {ice.descrizione && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-5 whitespace-pre-line">
                  {ice.descrizione}
                </p>
              )}

              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <p>
                  Firme ufficiali registrate: <strong>{ice.firme.toLocaleString("it-IT")}</strong>
                </p>
                {endDate && (
                  <p>
                    Scadenza raccolta: <strong>{endDate}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5">
              {officialUrl ? (
                <a href={officialUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Firma sul portale ufficiale UE
                  </Button>
                </a>
              ) : (
                <Button className="w-full" disabled>
                  Link ufficiale non disponibile
                </Button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
