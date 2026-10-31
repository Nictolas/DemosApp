import React from "react";
import { Crown } from "lucide-react";

// Intestazione centrata come Attivisti/Organizzazioni, sempre fuori dalla lista scorrevole.
export const Header: React.FC = () => (
  <div className="text-center">
    <div className="mb-2 flex items-center justify-center gap-2 px-10 sm:px-12">
      <Crown className="h-8 w-8 shrink-0 text-blue-600" aria-hidden="true" />
      <h1 className="min-w-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">Capo di Stato</h1>
    </div>
    <p className="text-sm text-gray-600 sm:text-base">
      Chi vorresti come Presidente della Repubblica?
    </p>
  </div>
);
