import React from "react";
import {
  CIVIC_SOURCE_LABELS,
  civicOfficialSourceUrl,
  type CivicSourceCategory,
} from "@/lib/civic-official-sources";

interface CivicOfficialInformationProps {
  category: CivicSourceCategory;
  description?: string | null;
  officialId?: string | number | null;
  sourceUrl?: string | null;
}

/**
 * Shared civic detail body. Reuses the record already loaded for the existing
 * page/dialog; no separate API call or personal query is made here.
 * Never presents the proposer's text as an independent fact check by DEMOS.
 */
export function CivicOfficialInformation({
  category, description, officialId, sourceUrl,
}: CivicOfficialInformationProps) {
  const source = civicOfficialSourceUrl(category, officialId, sourceUrl);
  const text = (description || "").trim();
  const isOfficialItem = category === "eci" || (
    officialId !== undefined && officialId !== null &&
    String(officialId).trim() !== ""
  );

  return (
    <section className="space-y-3" aria-label="Informazioni sulla proposta">
      <div>
        <h4 className="font-semibold text-gray-900 mb-2">Contenuto della proposta</h4>
        {text ? (
          <>
            <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">{text}</p>
            <details className="mt-2 rounded-lg border border-gray-200 p-3">
              <summary className="cursor-pointer font-medium text-gray-800">
                Leggi il testo completo
              </summary>
              <p className="mt-3 text-gray-700 whitespace-pre-wrap">{text}</p>
            </details>
          </>
        ) : (
          <p className="text-gray-600">
            La descrizione non è disponibile in questa scheda. Consulta il registro ufficiale.
          </p>
        )}
      </div>
      <p className="text-sm text-gray-600">
        {isOfficialItem
          ? "Il testo riporta la descrizione disponibile della proposta, non una valutazione di DEMOS. L’avvio della raccolta firme non equivale alla sua approvazione né anticipa eventuali risultati."
          : "Questa descrizione non è presentata come verificata da un registro istituzionale."}
      </p>
      {source && (
        <p className="text-sm">
          <a
            className="font-medium text-teal-700 underline underline-offset-2"
            href={source}
            target="_blank"
            rel="noopener noreferrer"
          >
            Consulta la fonte ufficiale — {CIVIC_SOURCE_LABELS[category]}
          </a>
        </p>
      )}
    </section>
  );
}
