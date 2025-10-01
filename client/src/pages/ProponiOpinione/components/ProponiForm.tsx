import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Plus } from "lucide-react";
import { ProponiFormProps } from "../types";

export const ProponiForm: React.FC<ProponiFormProps> = ({
  testoInput,
  submitting,
  onSubmit,
  onInputChange
}) => {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>Proponi una nuova opinione</span>
        </CardTitle>
        <CardDescription>
          Inserisci il testo della nuova opinione che vorresti proporre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Testo della nuova opinione..."
              value={testoInput}
              onChange={e => onInputChange(e.target.value)}
              disabled={submitting}
            />
            <Button 
              type="submit" 
              disabled={submitting || !testoInput.trim()} 
              className="bg-fuchsia-600 hover:bg-fuchsia-700"
            >
              <Plus className="h-4 w-4 mr-1" /> Proponi
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
