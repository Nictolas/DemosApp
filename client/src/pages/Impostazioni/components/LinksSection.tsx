import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Shield, Database, Download, Trash2, Settings, User, Lock, LogOut } from "lucide-react";

interface LinksSectionProps {
  onShowPasswordForm: () => void;
  onLogout: () => void;
}

export const LinksSection: React.FC<LinksSectionProps> = ({ onShowPasswordForm, onLogout }) => {
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
        {/* Layout 2x2 per i 4 pulsanti rimanenti */}
        <div className="grid grid-cols-2 gap-4">
          {/* GDPR */}
          <Link href="/gdpr">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">GDPR</div>
                <div className="text-xs text-gray-600">Diritti e gestione dati</div>
              </div>
            </Button>
          </Link>

          {/* Modifica Profilo */}
          <Link href="/menu/profilo">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Profilo</div>
                <div className="text-xs text-gray-600">Modifica informazioni</div>
              </div>
            </Button>
          </Link>

          {/* Cambia Password */}
          <Button 
            variant="outline" 
            className="w-full justify-start h-20 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
            onClick={onShowPasswordForm}
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Password</div>
              <div className="text-xs text-gray-600">Cambia credenziali</div>
            </div>
          </Button>

          {/* Logout */}
          <Button 
            variant="outline" 
            className="w-full justify-start h-20 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 group"
            onClick={onLogout}
          >
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
              <LogOut className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-gray-900">Logout</div>
              <div className="text-xs text-gray-600">Esci dall'account</div>
            </div>
          </Button>
        </div>

      </CardContent>
    </Card>
  );
};
