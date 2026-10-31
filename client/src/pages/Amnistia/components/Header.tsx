import React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

export const Header: React.FC = () => (
  <>
    {/* Titolo fisso e compatto su telefono/tablet: nessun ritorno a Vota. */}
    <div className="flex items-center gap-2 py-1 lg:hidden">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600">
        <Scale className="h-4 w-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold leading-tight text-green-700">Amnistia</h1>
        <p className="mt-0.5 text-xs leading-snug text-gray-600">
          Per quali reati richiederesti un'amnistia?
        </p>
      </div>
    </div>

    {/* Intestazione estesa sul desktop, sempre fuori dalla lista scorrevole. */}
    <div className="hidden lg:block">
      <Card className="mb-2 border-0 bg-gradient-to-br from-white via-green-50/30 to-emerald-50/40 shadow-sm">
        <CardHeader className="px-4 py-3 text-center">
          <div className="mb-2 flex justify-center">
            <span className="rounded-full bg-gradient-to-r from-green-500 to-emerald-700 p-2.5">
              <Scale className="h-8 w-8 text-white" />
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-green-700">Amnistia</CardTitle>
          <CardDescription className="mt-1 text-sm">
            Per quali reati ritieni dovrebbe essere concessa un'amnistia?
            L'amnistia estingue il reato e fa cessare l'esecuzione della relativa pena nei casi previsti dalla legge.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  </>
);
