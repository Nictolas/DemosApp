import React from "react";
import { EmptyStateProps } from "../types";

export const EmptyState: React.FC<EmptyStateProps> = ({ categoria, getTitolo }) => {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-xl font-semibold mb-2">Nessun candidato disponibile</h2>
        <p className="text-gray-600">
          Non ci sono candidati disponibili per la categoria {getTitolo()}.
        </p>
      </div>
    </div>
  );
};
