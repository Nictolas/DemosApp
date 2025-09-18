import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Shield, Database, Download, Trash2, Settings, User, Lock, LogOut, AlertTriangle } from "lucide-react";
import { ChangePasswordForm } from "../types";

interface LinksSectionProps {
  formData: ChangePasswordForm;
  isChangingPassword: boolean;
  showChangePassword: boolean;
  onUpdateField: (field: keyof ChangePasswordForm, value: string) => void;
  onShowForm: () => void;
  onHideForm: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onLogout: () => void;
}

export const LinksSection: React.FC<LinksSectionProps> = ({ 
  formData,
  isChangingPassword,
  showChangePassword,
  onUpdateField,
  onShowForm,
  onHideForm,
  onSubmit,
  onLogout 
}) => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 backdrop-blur-sm">
      {/* Decorative background */}
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
        {/* Layout 2x3 per i 6 pulsanti */}
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
            onClick={onShowForm}
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

          {/* Segnala Problema */}
          <Link href="/segnala-problema">
            <Button 
              variant="outline" 
              className="w-full justify-start h-20 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 hover:from-orange-100 hover:to-yellow-100 hover:border-orange-300 hover:shadow-lg transition-all duration-300 group"
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

        {/* Form Cambio Password */}
        {showChangePassword && (
          <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/50 border border-gray-200">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password attuale</label>
                <input
                  type="password"
                  placeholder="Inserisci la password attuale"
                  value={formData.currentPassword}
                  onChange={e => onUpdateField('currentPassword', e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nuova password</label>
                <input
                  type="password"
                  placeholder="Inserisci la nuova password"
                  value={formData.newPassword}
                  onChange={e => onUpdateField('newPassword', e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Conferma nuova password</label>
                <input
                  type="password"
                  placeholder="Conferma la nuova password"
                  value={formData.confirmPassword}
                  onChange={e => onUpdateField('confirmPassword', e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300"
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
                  className="h-12 px-6 rounded-xl border-2 border-gray-300 hover:border-gray-400 transition-all duration-300"
                >
                  Annulla
                </Button>
              </div>
            </form>
          </div>
        )}

      </CardContent>
    </Card>
  );
};
