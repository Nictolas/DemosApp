import React from "react";
import { Globe2 } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-4">
        <Globe2 className="h-8 w-8 text-blue-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Iniziative Popolari</h1>
      </div>
      <p className="text-gray-600 max-w-2xl mx-auto">
        Le iniziative popolari sono uno strumento di democrazia diretta che permette ai cittadini 
        di proporre nuove leggi o modifiche a leggi esistenti. Per essere valide, devono raccogliere 
        un numero significativo di firme entro un determinato periodo di tempo.
      </p>
    </div>
  );
};
