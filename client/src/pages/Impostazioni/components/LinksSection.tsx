import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Shield, Database } from "lucide-react";

export const LinksSection: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Collegamenti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href="/privacy-policy">
          <Button variant="outline" className="w-full justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Privacy Policy
          </Button>
        </Link>
        
        <Link href="/gdpr-rights">
          <Button variant="outline" className="w-full justify-start">
            <Shield className="h-4 w-4 mr-2" />
            Diritti GDPR
          </Button>
        </Link>
        <Link href="/data-retention">
          <Button variant="outline" className="w-full justify-start">
            <Database className="h-4 w-4 mr-2" />
            Data Retention
          </Button>
        </Link>
        
        <Link href="/informazioni">
          <Button variant="outline" className="w-full justify-start">
            <FileText className="h-4 w-4 mr-2" />
            Informazioni
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
