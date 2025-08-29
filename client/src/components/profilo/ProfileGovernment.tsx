import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { ProfileGovernmentProps } from "./types";

export function ProfileGovernment({ governoIdeale }: ProfileGovernmentProps) {
  if (!governoIdeale || Object.keys(governoIdeale).length === 0) {
    return null;
  }

  return (
    <Card className="animate-in-delay bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Il Tuo Governo Ideale
        </CardTitle>
        <CardDescription>
          I ministri che hai selezionato per il tuo governo ideale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(governoIdeale).map(([categoria, nome]) => (
            <div key={categoria} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2 capitalize">
                {categoria.replace(/_/g, ' ')}
              </h3>
              <div className="bg-white border border-blue-200 rounded-md p-3">
                <span className="text-blue-900 font-medium">{nome as string}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
