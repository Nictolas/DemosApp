import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export const Header = () => {
  return (
    <Card className="mt-6 mb-8">
      <CardHeader>
        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          Reclama Profilo
        </CardTitle>
        <CardDescription className="text-lg">
          Sei un rappresentante eletto? Verifica subito se il tuo profilo esiste e richiedi il 'badge verificato' per accedere a DEMOS Premium!
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
