import React from "react";
import { Crown } from "lucide-react";

// Testata compatta, lasciando intatta la sezione Consenso sottostante.
export const Header: React.FC = () => (
  <div className="text-center">
    <div className="flex items-center justify-center gap-2 px-11 sm:px-12">
      <Crown className="h-7 w-7 shrink-0 text-blue-600" aria-hidden="true" />
      <h1 className="min-w-0 whitespace-nowrap text-lg font-bold leading-tight text-gray-900 min-[360px]:text-xl sm:text-2xl">Capo di Stato</h1>
    </div>
    <p className="sr-only">Chi vorresti come Presidente della Repubblica?</p>
  </div>
);
