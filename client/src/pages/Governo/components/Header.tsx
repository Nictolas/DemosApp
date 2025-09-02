import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft } from "lucide-react";
import { HeaderProps } from "../types";

export const Header: React.FC<HeaderProps> = ({ unlockDate }) => {
  return (
    <>
      <Button 
        variant="ghost" 
        className="mb-4 flex items-center" 
        onClick={() => window.location.href = "/menu"}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu
      </Button>
      
      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full">
              <Building2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Il Tuo Governo Ideale</CardTitle>
          <CardDescription className="text-lg">
            Scegli chi vorresti a capo di ogni ministero.
          </CardDescription>
        </CardHeader>
      </Card>

      {unlockDate && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
          <b>Hai già modificato le tue preferenze questa settimana.</b><br />
          Potrai modificarle di nuovo dal: {unlockDate}
        </div>
      )}
    </>
  );
};
