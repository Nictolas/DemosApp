import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut } from "lucide-react";

interface LogoutSectionProps {
  isLoggingOut: boolean;
  onLogout: () => void;
}

export const LogoutSection: React.FC<LogoutSectionProps> = ({
  isLoggingOut,
  onLogout
}) => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/30 to-pink-50/50 backdrop-blur-sm">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400/20 to-pink-500/20 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-400/20 to-red-500/20 rounded-full translate-y-12 -translate-x-12"></div>
      
      <CardHeader className="relative">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
            <LogOut className="h-5 w-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Esci dall'Account
          </span>
        </CardTitle>
        <CardDescription className="text-gray-600 text-base">
          Disconnettiti in modo sicuro dalla piattaforma
        </CardDescription>
      </CardHeader>
      
      <CardContent className="relative">
        <Button 
          variant="destructive" 
          className="w-full h-14 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <>
              <div className="h-5 w-5 mr-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <div className="text-left">
                <div className="font-semibold text-white">Disconnessione...</div>
                <div className="text-sm text-red-100">Attendere prego</div>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                <LogOut className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">Logout</div>
                <div className="text-sm text-red-100">Disconnettiti dal tuo account</div>
              </div>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
