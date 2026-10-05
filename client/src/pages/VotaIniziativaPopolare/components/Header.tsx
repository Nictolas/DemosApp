import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/vota" className="lg:hidden">
        <Button variant="ghost" className="mb-4 flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-linear-to-r from-green-500 to-green-700 rounded-full">
              <Scale className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-linear-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Iniziative Popolari
          </CardTitle>
          <CardDescription className="text-lg">
            In questa pagina puoi votare le iniziative popolari che hanno già raggiunto il quorum e sono in lista d'attesa per essere esaminate dal Parlamento. Puoi votare quelle che secondo te dovrebbero avere la priorità.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
