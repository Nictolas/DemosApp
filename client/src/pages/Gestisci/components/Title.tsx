import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

export const Title: React.FC = () => {
  return (
    <Card className="border-0 shadow-lg bg-linear-to-r from-purple-600 to-pink-600 text-white">
      <CardHeader className="text-center py-6">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Settings className="h-8 w-8 text-white" />
        </div>
        <CardTitle className="text-3xl font-bold mb-2">
          Gestisci
        </CardTitle>
        <CardDescription className="text-purple-100 text-lg">
          Amministra utenti ed elezioni della piattaforma
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
