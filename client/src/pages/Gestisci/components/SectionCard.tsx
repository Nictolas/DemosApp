import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GestisciSection } from "../constants/sections";

interface SectionCardProps {
  section: GestisciSection;
}

export const SectionCard: React.FC<SectionCardProps> = ({ section }) => {
  const IconComponent = section.icon;

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 ${section.color}`}>
          <IconComponent className="h-5 w-5" />
          {section.title}
        </CardTitle>
        <CardDescription>
          {section.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          className={`w-full ${section.buttonColor}`}
          onClick={() => window.location.href = section.route}
        >
          <IconComponent className="mr-2 h-4 w-4" />
          {section.buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};
