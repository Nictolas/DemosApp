import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Shield, Database, Download, Trash2, Settings } from "lucide-react";

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
        {/* Sezione Gestione Dati */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Gestione Dati</h4>
          <Link href="/impostazioni/scarica-dati">
            <Button variant="outline" className="w-full justify-start">
              <Download className="h-4 w-4 mr-2" />
              Scarica i Tuoi Dati
            </Button>
          </Link>
          
          <Link href="/impostazioni/gestione-privacy">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Gestione Privacy
            </Button>
          </Link>
        </div>

        <Separator />

        {/* Sezione Account */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Account</h4>
          <Link href="/impostazioni/cancella-account">
            <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              Cancella Account
            </Button>
          </Link>
        </div>

        <Separator />

        {/* Sezione Documenti */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Documenti</h4>
          <Link href="/privacy-policy">
            <Button variant="outline" className="w-full justify-start">
              <FileText className="h-4 w-4 mr-2" />
              Privacy Policy
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
        </div>
      </CardContent>
    </Card>
  );
};
