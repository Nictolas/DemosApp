import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Image, Globe, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { UserInfo } from "@/types/profile";
import { TIPOLOGIE_ATTIVISMO } from "@/constants/attivismo-types";

interface ProfileInfoProps {
  userInfo: UserInfo;
  isEditing: boolean;
  onEditClick: () => void;
  onModificaImmagine: () => void;
  onModificaSiti?: () => void;
  canEdit?: boolean;
}

export const ProfileInfo = ({ 
  userInfo, 
  isEditing, 
  onEditClick, 
  onModificaImmagine,
  onModificaSiti,
  canEdit = true
}: ProfileInfoProps) => {
  const [, setLocation] = useLocation();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Non specificata';
    
    // Se la data è già nel formato DD/MM/YYYY, restituiscila così
    if (dateString.includes('/') && dateString.split('/').length === 3) {
      return dateString;
    }
    
    // Altrimenti prova a formattarla
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Restituisci la stringa originale se non è una data valida
      }
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  const getFullName = () => {
    if (userInfo.nome_completo) {
      return userInfo.nome_completo;
    }
    if (userInfo.nome && userInfo.cognome) {
      return `${userInfo.nome} ${userInfo.cognome}`;
    }
    return userInfo.nome || userInfo.cognome || 'Nome non disponibile';
  };

  return (
    <div className="transform hover:scale-[1.02] transition-all duration-300">
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/50 backdrop-blur-sm rounded-2xl">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/20 to-orange-500/20 rounded-full translate-y-12 -translate-x-12"></div>
        
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Image className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Informazioni Profilo
            </span>
          </CardTitle>
          <CardDescription className="text-gray-600 text-base">
            I tuoi dati personali e informazioni di contatto
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                <label className="text-sm font-semibold text-blue-700 uppercase tracking-wider">Nome Completo</label>
                <p className="text-xl font-bold text-gray-900 mt-1">{getFullName()}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
                <label className="text-sm font-semibold text-green-700 uppercase tracking-wider">Email</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.email || 'Non specificata'}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <label className="text-sm font-semibold text-purple-700 uppercase tracking-wider">Data di Nascita</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{formatDate(userInfo.data_nascita)}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
                <label className="text-sm font-semibold text-orange-700 uppercase tracking-wider">Genere</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.genere || 'Non specificato'}</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                <label className="text-sm font-semibold text-cyan-700 uppercase tracking-wider">Paese</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.paese_residenza || 'Non specificato'}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200">
                <label className="text-sm font-semibold text-teal-700 uppercase tracking-wider">Regione</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.regione_residenza || 'Non specificata'}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                <label className="text-sm font-semibold text-indigo-700 uppercase tracking-wider">Provincia</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.provincia_residenza || 'Non specificata'}</p>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <label className="text-sm font-semibold text-pink-700 uppercase tracking-wider">Comune</label>
                <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.comune_residenza || 'Non specificato'}</p>
              </div>
            </div>
          </div>
          
          {(userInfo.professione || userInfo.istruzione || userInfo.telefono) && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Informazioni Aggiuntive
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {userInfo.professione && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                    <label className="text-sm font-semibold text-amber-700 uppercase tracking-wider">Professione</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.professione}</p>
                  </div>
                )}
                
                {userInfo.istruzione && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                    <label className="text-sm font-semibold text-emerald-700 uppercase tracking-wider">Istruzione</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.istruzione}</p>
                  </div>
                )}
                
                {userInfo.telefono && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
                    <label className="text-sm font-semibold text-violet-700 uppercase tracking-wider">Telefono</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{userInfo.telefono}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Sezione Tipologie di Attivismo - Solo per Attivisti e Admin */}
          {(userInfo.ruolo === "Attivista" || userInfo.ruolo === "Admin") && userInfo.tipologie_attivismo && userInfo.tipologie_attivismo.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                  <Heart className="h-3 w-3 text-white" />
                </div>
                Tipologie di Attivismo
              </h3>
              <div className="flex flex-wrap gap-3">
                {userInfo.tipologie_attivismo.map((tipo) => {
                  const tipologia = TIPOLOGIE_ATTIVISMO.find(t => t.tipo === tipo);
                  if (!tipologia) return null;
                  
                  return (
                    <Badge
                      key={tipo}
                      variant="secondary"
                      className="flex items-center gap-2 px-4 py-2 text-sm"
                      style={{ backgroundColor: `${tipologia.colore}20`, color: tipologia.colore }}
                    >
                      <span className="text-lg">{tipologia.emoji}</span>
                      <span className="font-medium">{tipologia.nome}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="relative flex gap-3 pt-6">
          {canEdit && (
            <>
              <Button 
                onClick={onModificaImmagine} 
                variant="outline"
                className="flex-1 h-12 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                  <Image className="h-3 w-3 text-white" />
                </div>
                <span className="font-semibold">Modifica Immagine</span>
              </Button>
              {(userInfo.ruolo === "Attivista" || userInfo.ruolo === "Admin") && onModificaSiti && (
                <Button 
                  onClick={onModificaSiti} 
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="h-6 w-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Globe className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-semibold">Modifica Siti</span>
                </Button>
              )}
              {!isEditing && (
                <Button 
                  onClick={onEditClick}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <div className="h-6 w-6 rounded-md bg-white/20 flex items-center justify-center mr-3 group-hover:scale-110 transition-transform duration-300">
                    <Edit className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-semibold text-white">Modifica Profilo</span>
                </Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};
