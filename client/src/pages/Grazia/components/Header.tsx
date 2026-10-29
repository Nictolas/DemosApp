import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/vota">
        <Button variant="ghost" className="mb-2 flex h-11 items-center px-2 sm:mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna a Vota
        </Button>
      </Link>
      
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:flex-col sm:gap-4 sm:text-center">
            <div className="shrink-0 rounded-full bg-gradient-to-r from-green-500 to-green-700 p-2.5 sm:p-4">
              <Scale className="h-7 w-7 text-white sm:h-12 sm:w-12" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent sm:text-3xl">
                Grazia
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-snug sm:text-lg">
                Vota per chiedere la grazia a favore di un carcerato.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </>
  );
};
