import React from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <CardHeader className="text-center pb-4">
      <div className="flex justify-center mb-4">
        <div className="p-4 bg-gradient-to-r from-fuchsia-500 to-fuchsia-700 rounded-full">
          <MessageSquare className="h-12 w-12 text-white" />
        </div>
      </div>
      <CardTitle className="text-3xl font-bold bg-gradient-to-r from-fuchsia-600 to-fuchsia-800 bg-clip-text text-transparent">
        Proponi Opinione
      </CardTitle>
      <CardDescription className="text-lg">
        Proponi una nuova opinione per Demos oppure vota una delle opinioni proposte.
      </CardDescription>
    </CardHeader>
  );
};
