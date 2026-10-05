import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, Settings } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="relative mb-12">
      {/* Background decorative elements */}
      <div className="absolute -top-4 -left-4 w-24 h-24 bg-linear-to-br from-blue-400 to-purple-500 rounded-full opacity-10 blur-xl"></div>
      <div className="absolute -top-2 -right-4 w-16 h-16 bg-linear-to-br from-pink-400 to-orange-500 rounded-full opacity-10 blur-xl"></div>
      
      <div className="relative flex items-center gap-4">
        <Link href="/menu">
          <Button 
            variant="ghost" 
            size="icon"
            className="h-12 w-12 rounded-full bg-white border border-white/20 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300"
          >
            <Home className="h-5 w-5 text-gray-700" />
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Impostazioni
            </h1>
            <p className="text-gray-600 text-lg font-medium">
              Gestisci il tuo account e le preferenze
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
