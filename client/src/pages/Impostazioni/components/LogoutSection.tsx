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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LogOut className="h-5 w-5" />
          Esci dall'Account
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button 
          variant="destructive" 
          className="w-full"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Disconnessione...
            </>
          ) : (
            <>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
