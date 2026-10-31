import React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      {/* Testata compatta su smartphone e tablet, senza pulsanti di ritorno. */}
      <div className="flex items-center gap-2 py-1 lg:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600">
          <Crown className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-purple-700">Capo di Stato</h1>
          <p className="mt-0.5 text-xs leading-snug text-gray-600">
            Chi vorresti come Presidente della Repubblica?
          </p>
        </div>
      </div>

      {/* Testata estesa solo su PC, fuori dalla classifica scorrevole. */}
      <div className="hidden lg:block">
        <Card className="mb-2 shrink-0">
          <CardHeader className="px-4 py-3 text-center">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-gradient-to-r from-purple-500 to-purple-700 p-2.5">
                <Crown className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-2xl font-bold text-transparent">
              Capo di Stato
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Vota la persona italiana più meritevole di essere il Presidente della Repubblica.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
};
