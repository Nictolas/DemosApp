import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, AlertTriangle, Settings, Scale, User, Award } from "lucide-react";

interface LinksSectionProps {
  onLogout: () => void;
}

export const LinksSection: React.FC<LinksSectionProps> = ({ onLogout }) => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 backdrop-blur-sm">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/20 to-orange-500/20 rounded-full translate-y-12 -translate-x-12"></div>

      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Impostazioni
          </span>
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Gestisci il tuo account e le preferenze
        </CardDescription>
      </CardHeader>

      <CardContent className="relative space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href="/profilo">
            <Button
              variant="outline"
              className="w-full justify-start min-h-[4.5rem] h-auto py-3 rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Profilo</div>
                <div className="text-xs text-gray-600">Gestisci il tuo profilo</div>
              </div>
            </Button>
          </Link>

          <Link href="/impostazioni/informazioni-legali">
            <Button
              variant="outline"
              className="w-full justify-start min-h-[4.5rem] h-auto py-3 rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Informazioni Legali</div>
                <div className="text-xs text-gray-600">GDPR, Policy e Copyright</div>
              </div>
            </Button>
          </Link>

          <Link href="/riconoscimento">
            <Button
              variant="outline"
              className="w-full justify-start min-h-[4.5rem] h-auto py-3 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 hover:border-emerald-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Riconoscimento</div>
                <div className="text-xs text-gray-600">Sono un politico / candidato</div>
              </div>
            </Button>
          </Link>

          <Button
            variant="outline"
            className="w-full justify-start min-h-[4.5rem] h-auto py-3 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 group"
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

          <Link href="/segnala-problema">
            <Button
              variant="outline"
              className="w-full justify-start min-h-[4.5rem] h-auto py-3 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 hover:border-orange-300 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Segnala Problema</div>
                <div className="text-xs text-gray-600">Aiutaci a migliorare</div>
              </div>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
