import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe2 } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <Link href="/menu">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center space-x-2">
          <Globe2 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Iniziative Cittadini Europei</h1>
        </div>
      </div>
    </div>
  );
};
