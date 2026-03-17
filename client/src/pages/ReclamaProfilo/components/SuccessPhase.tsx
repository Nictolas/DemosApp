import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface SuccessPhaseProps {
  onNewRequest: () => void;
}

export const SuccessPhase: React.FC<SuccessPhaseProps> = ({ onNewRequest }) => {
  return (
    <Card className="mb-8 text-center">
      <CardContent className="p-8">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-green-700 mb-2">Richiesta inviata!</h3>
        <p className="text-lg text-muted-foreground mb-4">
          Riceverai una notifica non appena verificato.
        </p>
        <Button onClick={onNewRequest}>
          Invia un'altra richiesta
        </Button>
      </CardContent>
    </Card>
  );
};
