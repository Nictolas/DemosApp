import React from "react";
import { Vote } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-4">
        <Vote className="h-8 w-8 text-blue-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Referendum Abrogativi</h1>
      </div>
      <p className="text-gray-600 max-w-2xl mx-auto">
        I referendum abrogativi sono uno strumento di democrazia diretta che permette ai cittadini 
        di abrogare leggi esistenti. Per essere validi, devono raccogliere un numero significativo 
        di firme entro un determinato periodo di tempo.
      </p>
    </div>
  );
};
