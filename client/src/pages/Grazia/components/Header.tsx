import React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      {/* Titolo compatto su smartphone e tablet, senza collegamenti di ritorno. */}
      <div className="flex items-center gap-2 py-1 lg:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600">
          <Scale className="h-4 w-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-green-700">Grazia</h1>
          <p className="mt-0.5 text-xs leading-snug text-gray-600">
            Chiedi la grazia per un carcerato.
          </p>
        </div>
      </div>

      {/* Su PC resta l'intestazione estesa, sempre fuori dallo scroll. */}
      <div className="hidden lg:block">
        <Card className="mb-2">
          <CardHeader className="p-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="shrink-0 rounded-full bg-gradient-to-r from-green-500 to-green-700 p-3">
                <Scale className="h-9 w-9 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-2xl font-bold text-transparent">
                  Grazia
                </CardTitle>
                <CardDescription className="mt-1 text-base">
                  Vota per chiedere la grazia a favore di un carcerato.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </>
  );
};
