import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export const Title: React.FC = () => {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Settings className="h-6 w-6" />
          Gestisci
        </CardTitle>
        <CardDescription>
          Amministra utenti ed elezioni della piattaforma
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
