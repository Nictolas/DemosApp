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
    <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer group border-0 shadow-md bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className={`w-12 h-12 rounded-xl ${section.buttonColor.replace('bg-', 'bg-').replace('hover:bg-', '')} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
          <IconComponent className="h-6 w-6 text-white" />
        </div>
        <CardTitle className={`text-lg font-semibold ${section.color} group-hover:text-gray-900 transition-colors duration-300`}>
          {section.title}
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 leading-relaxed">
          {section.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          className={`w-full ${section.buttonColor} hover:shadow-lg transition-all duration-300 font-medium`}
          onClick={() => window.location.href = section.route}
        >
          <IconComponent className="mr-2 h-4 w-4" />
          {section.buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};
