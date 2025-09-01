import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, User, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChangePasswordForm } from "../types";

interface SecuritySectionProps {
  formData: ChangePasswordForm;
  isChangingPassword: boolean;
  showChangePassword: boolean;
  onUpdateField: (field: keyof ChangePasswordForm, value: string) => void;
  onShowForm: () => void;
  onHideForm: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  formData,
  isChangingPassword,
  showChangePassword,
  onUpdateField,
  onShowForm,
  onHideForm,
  onSubmit
}) => {
  const { toast } = useToast();

  const showMigrationMessage = (feature: string) => {
    toast({
      title: "Funzione temporaneamente disabilitata",
      description: `${feature} sarà disponibile dopo il completamento della migrazione da Firebase.`,
      variant: "default",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Sicurezza Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href="/menu/profilo">
          <Button className="w-full">
            <User className="h-4 w-4 mr-2" />
            Modifica Profilo
          </Button>
        </Link>

        {!showChangePassword ? (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={onShowForm}
          >
            <Lock className="h-4 w-4 mr-2" />
            Cambia Password
          </Button>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Password attuale</label>
              <input
                type="password"
                placeholder="Inserisci la password attuale"
                value={formData.currentPassword}
                onChange={e => onUpdateField('currentPassword', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Nuova password</label>
              <input
                type="password"
                placeholder="Inserisci la nuova password"
                value={formData.newPassword}
                onChange={e => onUpdateField('newPassword', e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Conferma nuova password</label>
              <input
                type="password"
                placeholder="Conferma la nuova password"
                value={formData.confirmPassword}
                onChange={e => onUpdateField('confirmPassword', e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Aggiornamento...
                  </>
                ) : (
                  "Aggiorna Password"
                )}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={onHideForm}
              >
                Annulla
              </Button>
            </div>
          </form>
        )}
        
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => showMigrationMessage("Eliminazione account")}
        >
          <Shield className="h-4 w-4 mr-2" />
          Elimina Account
        </Button>
      </CardContent>
    </Card>
  );
};
