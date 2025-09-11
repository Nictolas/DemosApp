import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Shield, Database, Download, Trash2, Settings } from "lucide-react";

export const LinksSection: React.FC = () => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 backdrop-blur-sm">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/20 to-orange-500/20 rounded-full translate-y-12 -translate-x-12"></div>
      
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Collegamenti
          </span>
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Accedi alle funzionalità e documenti della piattaforma
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative space-y-6">
        {/* Sezione GDPR */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Diritti GDPR</h4>
          <Link href="/gdpr">
            <Button 
              variant="outline" 
              className="w-full justify-start h-14 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Diritti GDPR</div>
                <div className="text-sm text-gray-600">Gestisci i tuoi diritti sulla protezione dati</div>
              </div>
            </Button>
          </Link>
        </div>

        <Separator className="bg-gradient-to-r from-transparent via-gray-300 to-transparent" />

        {/* Sezione Documenti */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Documenti</h4>
          <div className="grid gap-3">
            <Link href="/privacy-policy">
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-300 group"
              >
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-3 w-3 text-white" />
                </div>
                <span className="font-medium">Privacy Policy</span>
              </Button>
            </Link>
            
            
            <Link href="/informazioni">
              <Button 
                variant="outline" 
                className="w-full justify-start h-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-md transition-all duration-300 group"
              >
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-3 w-3 text-white" />
                </div>
                <span className="font-medium">Informazioni</span>
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
