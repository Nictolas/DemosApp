import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/vota" className="lg:hidden">
        <Button variant="ghost" className="mb-4 flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
        </Button>
      </Link>

      <Card className="mb-6 lg:mb-0 shrink-0">
        <CardHeader className="text-center lg:py-4 lg:pb-3">
          <div className="flex justify-center mb-4 lg:mb-2">
            <div className="p-4 lg:p-2.5 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full">
              <Crown className="h-12 w-12 lg:h-8 lg:w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl lg:text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
            Capo di Stato
          </CardTitle>
          <CardDescription className="text-lg lg:text-sm lg:mt-1">
            Vota la persona italiana più meritevole di essere il Presidente della Repubblica.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
