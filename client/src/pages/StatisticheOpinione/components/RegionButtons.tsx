import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REGIONI } from "../constants";

interface RegionButtonsProps {
  opinionId: string;
}

export const RegionButtons: React.FC<RegionButtonsProps> = ({ opinionId }) => {
  const [, setLocation] = useLocation();

  return (
    <Card className="bg-white shadow-lg">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {REGIONI.map((regione) => (
            <Button
              key={regione}
              variant="outline"
              className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
              onClick={() => setLocation(`/statistiche-opinione/${opinionId}/regione/${regione.toLowerCase().replace(/\s+/g, '-')}`)}
            >
              {regione}
            </Button>
          ))}
          <Button
            variant="default"
            className="w-full h-16 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setLocation(`/statistiche-opinione/${opinionId}/tutte-regioni`)}
          >
            Italia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
