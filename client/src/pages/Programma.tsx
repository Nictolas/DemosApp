import React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Programma() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              Programma
            </CardTitle>
            <CardDescription>
              Qui potrai visualizzare o modificare il programma (prossimamente).
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
} 