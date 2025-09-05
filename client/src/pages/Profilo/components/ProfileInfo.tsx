import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Image } from "lucide-react";
import { useLocation } from "wouter";
import { UserInfo } from "@/types/profile";

interface ProfileInfoProps {
  userInfo: UserInfo;
  isEditing: boolean;
  onEditClick: () => void;
  onModificaImmagine: () => void;
  canEdit?: boolean;
}

export const ProfileInfo = ({ 
  userInfo, 
  isEditing, 
  onEditClick, 
  onModificaImmagine,
  canEdit = true
}: ProfileInfoProps) => {
  const [, setLocation] = useLocation();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Non specificata';
    try {
      return new Date(dateString).toLocaleDateString('it-IT');
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
    <Card className="animate-in-delay bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Informazioni Profilo
        </CardTitle>
        <CardDescription>
          I tuoi dati personali e informazioni di contatto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Nome Completo</label>
              <p className="text-lg font-semibold text-gray-900">{getFullName()}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-lg text-gray-900">{userInfo.email || 'Non specificata'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Data di Nascita</label>
              <p className="text-lg text-gray-900">{formatDate(userInfo.data_nascita)}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Genere</label>
              <p className="text-lg text-gray-900">{userInfo.genere || 'Non specificato'}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Paese</label>
              <p className="text-lg text-gray-900">{userInfo.paese_residenza || 'Non specificato'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Regione</label>
              <p className="text-lg text-gray-900">{userInfo.regione_residenza || 'Non specificata'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Provincia</label>
              <p className="text-lg text-gray-900">{userInfo.provincia_residenza || 'Non specificata'}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Comune</label>
              <p className="text-lg text-gray-900">{userInfo.comune_residenza || 'Non specificato'}</p>
            </div>
          </div>
        </div>
        
        {(userInfo.professione || userInfo.istruzione || userInfo.telefono) && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni Aggiuntive</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userInfo.professione && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Professione</label>
                  <p className="text-lg text-gray-900">{userInfo.professione}</p>
                </div>
              )}
              
              {userInfo.istruzione && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Istruzione</label>
                  <p className="text-lg text-gray-900">{userInfo.istruzione}</p>
                </div>
              )}
              
              {userInfo.telefono && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Telefono</label>
                  <p className="text-lg text-gray-900">{userInfo.telefono}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        {canEdit && (
          <>
            <Button onClick={onModificaImmagine} variant="outline">
              <Image className="mr-2 h-4 w-4" />
              Modifica Immagine
            </Button>
            {!isEditing && (
              <Button onClick={onEditClick}>
                <Edit className="mr-2 h-4 w-4" />
                Modifica Profilo
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};
