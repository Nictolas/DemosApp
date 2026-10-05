import React from "react";
import { Referendum } from "../types";
import { Check, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ReferendumProposteProps {
  referendumProposte: Referendum[];
  isLoading: boolean;
  isError: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onView?: (referendum: Referendum) => void;
}

export const ReferendumProposte: React.FC<ReferendumProposteProps> = ({
  referendumProposte,
  isLoading,
  isError,
  onApprove,
  onReject,
  onView
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center text-red-500 p-4">
        Errore nel caricamento dei referendum proposti.
      </div>
    );
  }

  if (referendumProposte.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nessun referendum proposto in attesa di approvazione.
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          Referendum Proposti in Attesa di Approvazione
          <Badge variant="secondary" className="ml-2">
            {referendumProposte.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {referendumProposte.map((referendum) => (
            <div 
              key={referendum.id} 
              className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-xs cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onView && onView(referendum)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full shrink-0"></div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {referendum.nome}
                    </h3>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      Proposta
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 mb-3 line-clamp-2">
                    {referendum.descrizione}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Data proposta: <strong>
                        {referendum.created_at
                          ? new Date(referendum.created_at).toLocaleDateString('it-IT')
                          : 'N/A'
                        }
                      </strong>
                    </span>
                    {referendum.sitoWeb && (
                      <a 
                        href={referendum.sitoWeb} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Visita sito
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {onView && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView(referendum)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onApprove(referendum.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {onReject && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(referendum.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
