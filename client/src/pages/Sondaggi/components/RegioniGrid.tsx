import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REGIONI } from "../constants/regioni";
import { useSondaggiUtils } from "../hooks/useSondaggiUtils";

export const RegioniGrid: React.FC = () => {
  const { regionToSlug } = useSondaggiUtils();

  return (
    <Card className="bg-white shadow-lg">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {REGIONI.map((regione) => (
            <Link key={regione} href={`/sondaggi/${regionToSlug(regione)}`}>
              <Button 
                variant="outline" 
                className="w-full h-16 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                {regione}
              </Button>
            </Link>
          ))}
          <Link href="/sondaggi/italia">
            <Button 
              variant="default" 
              className="w-full h-16 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white"
            >
              Italia
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
