import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <>
      <Link href="/menu">
        <Button variant="ghost" className="mb-4 flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
        </Button>
      </Link>

      <Card className="mb-6 bg-white">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-fuchsia-500 to-fuchsia-700 rounded-full">
              <MessageSquare className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-fuchsia-600 to-fuchsia-800 bg-clip-text text-transparent">
            Proponi Opinione
          </CardTitle>
          <CardDescription className="text-lg">
            Proponi nuove opinioni per Demos.<br />
            Gli admin valuteranno le proposte più votate.
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
};
