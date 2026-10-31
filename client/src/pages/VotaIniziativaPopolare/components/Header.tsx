import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-green-500 to-green-700 rounded-full">
              <Scale className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Iniziative Popolari
          </CardTitle>
          <CardDescription className="text-lg">
            In questa pagina puoi votare le iniziative popolari che hanno già raggiunto il quorum e sono in lista d'attesa per essere esaminate dal Parlamento. Puoi votare quelle che secondo te dovrebbero avere la priorità.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
