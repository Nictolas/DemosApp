import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { ProfileOpinionsProps } from "./types";
import { categorizeAllOpinions } from "./profileUtils";

export function ProfileOpinions({ userOpinions, opinionQuestions }: ProfileOpinionsProps) {
  if (!userOpinions || Object.keys(userOpinions).length === 0) {
    return null;
  }

  const { favorevoli, indecisi, contrari } = categorizeAllOpinions(userOpinions, opinionQuestions);

  return (
    <Card className="animate-in-delay bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Le Tue Opinioni Politiche
        </CardTitle>
        <CardDescription>
          Visualizzazione delle tue posizioni sui temi principali
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-6">
          <div className="space-y-3">
            <div className="bg-green-100 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                Favorevole
              </h3>
              <div className="space-y-2">
                {favorevoli.length > 0 ? (
                  favorevoli.map(({ id, label }) => (
                    <div key={id} className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center justify-between">
                      <span className="text-green-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-green-600 text-sm italic">Nessuna opinione favorevole</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                Indeciso
              </h3>
              <div className="space-y-2">
                {indecisi.length > 0 ? (
                  indecisi.map(({ id, label }) => (
                    <div key={id} className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-center justify-between">
                      <span className="text-yellow-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-yellow-600 text-sm italic">Nessuna opinione indecisa</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-red-100 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                Contrario
              </h3>
              <div className="space-y-2">
                {contrari.length > 0 ? (
                  contrari.map(({ id, label }) => (
                    <div key={id} className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center justify-between">
                      <span className="text-red-800 font-medium">{label}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-red-600 text-sm italic">Nessuna opinione contraria</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
