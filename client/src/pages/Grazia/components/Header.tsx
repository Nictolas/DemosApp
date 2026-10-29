import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Scale } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      {/* Mobile: one compact toolbar instead of a full-height hero card. */}
      <div className="flex items-center gap-2 py-1 sm:hidden">
        <Link href="/vota">
          <Button variant="ghost" className="h-11 shrink-0 px-1.5 text-sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Vota
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600">
              <Scale className="h-4 w-4 text-white" />
            </span>
            <h1 className="text-lg font-bold leading-tight text-green-700">Grazia</h1>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-gray-600">
            Chiedi la grazia per un carcerato.
          </p>
        </div>
      </div>

      {/* Retain the familiar expanded header on tablet and desktop. */}
      <div className="hidden sm:block">
        <Link href="/vota">
          <Button variant="ghost" className="mb-4 flex h-11 items-center px-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna a Vota
          </Button>
        </Link>
        <Card>
          <CardHeader className="p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="shrink-0 rounded-full bg-gradient-to-r from-green-500 to-green-700 p-4">
                <Scale className="h-12 w-12 text-white" />
              </div>
              <div className="min-w-0">
                <CardTitle className="bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-3xl font-bold text-transparent">
                  Grazia
                </CardTitle>
                <CardDescription className="mt-1 text-lg">
                  Vota per chiedere la grazia a favore di un carcerato.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    </>
  );
};
