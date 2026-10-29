import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Edit, Image, Heart, User } from "lucide-react";
import { useLocation } from "wouter";
import { UserInfo } from "@/types/profile";
import { TIPOLOGIE_ATTIVISMO } from "@/constants/attivismo-types";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

interface ProfileInfoProps {
  userInfo: UserInfo;
  isEditing: boolean;
  onEditClick: () => void;
  onModificaImmagine: () => void;
  canEdit?: boolean;
  avatarConfig?: any;
}

export const ProfileInfo = ({ 
  userInfo, 
  isEditing, 
  onEditClick, 
  onModificaImmagine,
  canEdit = true,
  avatarConfig
}: ProfileInfoProps) => {
  const [, setLocation] = useLocation();
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);

  // Funzione per verificare se l'utente di cui si sta visualizzando il profilo ha uno dei ruoli che possono avere l'avatar
  // IMPORTANTE: controlla il ruolo dell'utente di cui si sta visualizzando il profilo (userInfo.ruolo), non di chi guarda
  const canShowAvatar = () => {
    const ruolo = userInfo.ruolo;
    // Verifica sia i codici abbreviati che i nomi completi
    return (
      ruolo === "P" || ruolo === "Politico" ||
      ruolo === "C" || ruolo === "Candidato" || ruolo === "CP" || ruolo === "Candidato Politico" ||
      ruolo === "AD" || ruolo === "Admin"
    );
  };

  // Funzione per ottenere la configurazione avatar parsata
  const getAvatarConfig = () => {
    if (!avatarConfig) {
      return null;
    }
    
    // Se è già un oggetto, restituiscilo
    if (typeof avatarConfig === 'object' && avatarConfig !== null) {
      return avatarConfig;
    }
    
    // Se è una stringa, prova a parsarla
    if (typeof avatarConfig === 'string') {
      try {
        let parsed = JSON.parse(avatarConfig);
        // Se il risultato è ancora una stringa, fai un secondo parse (caso doppia serializzazione)
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        return parsed;
      } catch (e) {
        console.warn('Errore nel parsing avatar config:', e);
        return null;
      }
    }
    
    return null;
  };

  // Componente placeholder grigio per avatar vuoto
  const AvatarPlaceholder = ({ size = 120 }: { size?: number }) => (
    <div 
      className="rounded-full bg-gray-300 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <User className="text-gray-500" size={size * 0.5} />
    </div>
  );

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Non specificata';
    if (dateString.includes('/') && dateString.split('/').length === 3) return dateString;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  // GDPR: in profilo mostriamo solo l'anno di nascita
  const formatBirthYear = (dateString: string | undefined) => {
    if (!dateString) return 'Non specificato';
    const s = String(dateString).trim();
    if (/^\d{4}$/.test(s)) return s;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return String(date.getFullYear());
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

  const canShowFullName = () => {
    const ruolo = userInfo.ruolo;
    return (
      ruolo === "P" || ruolo === "Politico" ||
      ruolo === "C" || ruolo === "Candidato" ||
      ruolo === "CP" || ruolo === "Candidato Politico"
    );
  };

  return (
    <div>
      <Card className="relative overflow-hidden border-0 shadow-md bg-white rounded-2xl">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-400/20 to-orange-500/20 rounded-full translate-y-12 -translate-x-12"></div>
        
        <CardHeader className="relative px-4 pt-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-lg lg:text-xl font-bold">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shrink-0">
              <Image className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Informazioni Profilo
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="relative px-4 pb-2">
          {/* Avatar - Solo per Politico, Candidato e Admin */}
          {/* Mostra sempre l'avatar se l'utente di cui si sta visualizzando il profilo ha uno dei ruoli richiesti */}
          {canShowAvatar() && (
            <div className="mb-3 flex justify-start">
              <div 
                className={`p-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg ${canEdit ? 'cursor-pointer hover:shadow-xl transition-shadow duration-300' : ''}`}
                onClick={canEdit ? () => setShowAvatarDialog(true) : undefined}
                title={canEdit ? "Clicca per modificare l'avatar" : undefined}
              >
                {getAvatarConfig() ? (
                  <CustomAvatar 
                    config={getAvatarConfig()} 
                    size={80} 
                    className="rounded-full"
                  />
                ) : (
                  <AvatarPlaceholder size={80} />
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-3">
              {canShowFullName() && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Nome Completo</label>
                  <p className="text-base font-bold text-gray-900 mt-1 break-words">{getFullName()}</p>
                </div>
              )}
              
              <div className="p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                <label className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Anno di nascita</label>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{formatBirthYear(userInfo.data_nascita)}</p>
              </div>
              
              {/* Genere visibile solo per Politico (P), Candidato (C), Candidato Politico (CP) */}
              {canShowFullName() && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200">
                  <label className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Genere</label>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.genere || 'Non specificato'}</p>
                </div>
              )}
              
              {userInfo.cittadinanza && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200">
                  <label className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">Cittadinanza</label>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.cittadinanza}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200">
                <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">Paese</label>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.paese_residenza || 'Non specificato'}</p>
              </div>
              
              <div className="p-3 rounded-xl bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200">
                <label className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Regione</label>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.regione_residenza || 'Non specificata'}</p>
              </div>
              
              <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200">
                <label className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Provincia</label>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.provincia_residenza || 'Non specificata'}</p>
              </div>
              
              <div className="p-3 rounded-xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200">
                <label className="text-xs font-semibold text-pink-700 uppercase tracking-wider">Comune</label>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.comune_residenza || 'Non specificato'}</p>
              </div>
            </div>
          </div>
          
          {(userInfo.professione || userInfo.istruzione || userInfo.telefono) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Informazioni Aggiuntive
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {userInfo.professione && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                    <label className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Professione</label>
                    <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.professione}</p>
                  </div>
                )}
                
                {userInfo.istruzione && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
                    <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Istruzione</label>
                    <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.istruzione}</p>
                  </div>
                )}
                
                {userInfo.telefono && (
                  <div className="p-3 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
                    <label className="text-xs font-semibold text-violet-700 uppercase tracking-wider">Telefono</label>
                    <p className="text-sm sm:text-base font-semibold text-gray-900 mt-1 break-words">{userInfo.telefono}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Sezione Tipologie di Attivismo - Solo per Attivisti e Admin */}
          {(userInfo.ruolo === "A" || userInfo.ruolo === "AD") && userInfo.tipologie_attivismo && userInfo.tipologie_attivismo.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
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
        
        <CardFooter className="relative flex gap-3 px-4 pt-2 pb-4">
          {canEdit && !isEditing && (
            <Button 
              onClick={onEditClick}
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <Edit className="h-4 w-4 text-white mr-2" />
              <span className="font-semibold text-white">Modifica Profilo</span>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Dialog di conferma per modificare l'avatar */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Modifica Avatar</DialogTitle>
            <DialogDescription>
              Vuoi modificare il tuo avatar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>
              Annulla
            </Button>
            <Button onClick={() => {
              setShowAvatarDialog(false);
              onModificaImmagine();
            }}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
