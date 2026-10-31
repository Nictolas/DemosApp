import React from "react";
import { Crown } from "lucide-react";

// Intestazione centrata come Attivisti/Organizzazioni, sempre fuori dalla lista scorrevole.
export const Header: React.FC = () => (
  <div className="text-center">
    <div className="mb-1 flex items-center justify-center gap-2 px-4 sm:mb-2 sm:px-12">
      <Crown className="h-8 w-8 shrink-0 text-blue-600" aria-hidden="true" />
      <h1 className="min-w-0 whitespace-nowrap text-xl font-bold leading-tight text-gray-900 min-[360px]:text-2xl sm:text-3xl">Capo di Stato</h1>
    </div>
    <p className="hidden text-sm text-gray-600 sm:text-base [@media(min-height:680px)]:block">
      Chi vorresti come Presidente della Repubblica?
    </p>
  </div>
);
