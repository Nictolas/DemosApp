import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Provincia {
  nome: string;
}

interface SondaggiFiltersProps {
  filterPath?: string;
  filter?: {
    type: 'regione' | 'provincia' | 'comune';
    value?: string;
    regione?: string;
    provincia?: string;
    comune?: string;
  };
  provinceForRegion: Provincia[];
  comuniForProvincia: string[];
}

export function SondaggiFilters({ 
  filterPath, 
  filter, 
  provinceForRegion, 
  comuniForProvincia 
}: SondaggiFiltersProps) {
  // Pulsanti per statistiche provinciali - solo se siamo in una pagina filtrata per regione
  if (filterPath && filter?.type === 'regione') {
    return (
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {provinceForRegion.map((provincia) => (
              <Link 
                key={provincia.nome} 
                href={`/sondaggi/${filterPath}/${provincia.nome.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Button 
                  variant="outline" 
                  className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {provincia.nome}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pulsanti per statistiche comunali - solo se siamo in una pagina filtrata per provincia
  if (filterPath && filter?.type === 'provincia') {
    return (
      <Card className="bg-white shadow-lg">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {comuniForProvincia.map((comune) => (
              <Link 
                key={comune} 
                href={`/sondaggi/${filterPath}/${comune.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Button 
                  variant="outline" 
                  className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  {comune}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
