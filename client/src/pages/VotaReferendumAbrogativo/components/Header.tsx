import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trophy } from "lucide-react";

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
            <div className="p-4 bg-linear-to-r from-red-500 to-red-700 rounded-full">
              <Trophy className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-linear-to-r from-red-600 to-red-800 bg-clip-text text-transparent">
            Referendum Abrogativi
          </CardTitle>
          <CardDescription className="text-lg">
            Seleziona i referendum abrogativi che preferisci
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
