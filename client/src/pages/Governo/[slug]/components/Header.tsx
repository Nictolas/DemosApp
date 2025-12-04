import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { HeaderProps } from "../types";

export const Header: React.FC<HeaderProps> = ({ ministero, unlockDate }) => {
  const IconComponent = ministero.icon;

  return (
    <>
      <Link href="/governo">
        <Button variant="ghost" className="mb-4 flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Governo
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-700 rounded-full">
              <IconComponent className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-800 bg-clip-text text-transparent">
            {ministero.nome}
          </CardTitle>
          <CardDescription className="text-lg">
            Vota il candidato che ritieni più meritevole per questo ministero.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
