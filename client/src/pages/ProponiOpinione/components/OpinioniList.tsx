import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp } from "lucide-react";
import { OpinioniListProps } from "../types";

export const OpinioniList: React.FC<OpinioniListProps> = ({
  opinioni,
  userVoti,
  isVoting,
  onVota
}) => {
  if (opinioni.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ThumbsUp className="h-5 w-5" />
            <span>Opinioni proposte</span>
          </CardTitle>
          <CardDescription>
            Vota le opinioni che ritieni più importanti. L'admin valuterà le più votate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Nessuna opinione proposta al momento.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ThumbsUp className="h-5 w-5" />
          <span>Opinioni proposte</span>
        </CardTitle>
        <CardDescription>
          Vota le opinioni che ritieni più importanti. L'admin valuterà le più votate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {opinioni.map(op => (
            <li key={op.id} className="flex items-center justify-between border-b pb-2">
              <div>
                <span className="font-medium">{op.testo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-fuchsia-700 font-bold">{op.voti}</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  disabled={isVoting || userVoti.includes(op.id)} 
                  onClick={() => onVota(op.id)}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" /> Vota
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
