import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/vota">
        <Button variant="ghost" className="mb-4 flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
        </Button>
      </Link>

      <Card className="mb-6">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full">
              <Crown className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Capo di Stato
          </CardTitle>
          <CardDescription className="text-lg">
            Vota le tre persone italiane più meritevoli di essere il Presidente della Repubblica.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
