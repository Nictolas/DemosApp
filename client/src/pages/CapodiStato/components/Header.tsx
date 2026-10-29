import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      {/* Compact mobile heading instead of the full-height card. */}
      <div className="flex items-center gap-2 py-1 sm:hidden">
        <Link href="/vota">
          <Button variant="ghost" className="h-11 shrink-0 px-1.5 text-sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Vota
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600">
              <Crown className="h-4 w-4 text-white" />
            </span>
            <h1 className="text-lg font-bold leading-tight text-purple-700">Capo di Stato</h1>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-gray-600">
            Chi vorresti come Presidente della Repubblica?
          </p>
        </div>
      </div>
      {/* Original expanded header retained for wider screens. */}
      <div className="hidden sm:block">
        <Link href="/vota" className="lg:hidden">
          <Button variant="ghost" className="mb-4 flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna a Vota
          </Button>
        </Link>
        <Card className="mb-6 shrink-0 lg:mb-0">
          <CardHeader className="text-center lg:py-4 lg:pb-3">
            <div className="mb-4 flex justify-center lg:mb-2">
              <div className="rounded-full bg-gradient-to-r from-purple-500 to-purple-700 p-4 lg:p-2.5">
                <Crown className="h-12 w-12 text-white lg:h-8 lg:w-8" />
              </div>
            </div>
            <CardTitle className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-3xl font-bold text-transparent lg:text-2xl">
              Capo di Stato
            </CardTitle>
            <CardDescription className="text-lg lg:mt-1 lg:text-sm">
              Vota la persona italiana più meritevole di essere il Presidente della Repubblica.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </>
  );
};
