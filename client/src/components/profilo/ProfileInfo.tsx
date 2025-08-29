import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Edit, Image } from "lucide-react";
import { EditProfileForm } from "@/components/EditProfileForm";
import { ProfileInfoProps } from "./types";

export function ProfileInfo({ 
  userInfo, 
  isEditing, 
  onEdit, 
  onModificaImmagine, 
  canEditImage 
}: ProfileInfoProps) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-blue-600">
          Profilo Utente
        </CardTitle>
        <CardDescription>
          Visualizza e gestisci le tue informazioni personali
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <EditProfileForm 
            userData={{...userInfo, uid: userInfo.id}} 
            onProfileUpdated={async () => {
              // This will be handled by the parent component
            }}
            onCancel={() => {
              // This will be handled by the parent component
            }}
          />
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Informazioni personali</h3>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {userInfo.nome}</p>
                <p><strong>Cognome:</strong> {userInfo.cognome}</p>
                <p><strong>Data di nascita:</strong> {userInfo.data_nascita}</p>
                <p><strong>Genere:</strong> {userInfo.genere}</p>
                <p><strong>Cittadinanza:</strong> {userInfo.cittadinanza}</p>
                <p><strong>Ruolo:</strong> {userInfo.ruolo}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Residenza</h3>
              <div className="space-y-2">
                <p><strong>Paese:</strong> {userInfo.paese_residenza}</p>
                <p><strong>Regione:</strong> {userInfo.regione_residenza}</p>
                <p><strong>Provincia:</strong> {userInfo.provincia_residenza}</p>
                <p><strong>Comune:</strong> {userInfo.comune_residenza}</p>
              </div>
              
              {userInfo.paese_elezione && (
                <>
                  <h3 className="text-lg font-medium mt-4 mb-2">Elezione</h3>
                  <div className="space-y-2">
                    <p><strong>Paese:</strong> {userInfo.paese_elezione}</p>
                    <p><strong>Regione:</strong> {userInfo.regione_elezione}</p>
                    <p><strong>Provincia:</strong> {userInfo.provincia_elezione}</p>
                    <p><strong>Comune:</strong> {userInfo.comune_elezione}</p>
                    <p><strong>Grado:</strong> {userInfo.grado_elezione}</p>
                  </div>
                </>
              )}
              
              {userInfo.paese_candidatura && (
                <>
                  <h3 className="text-lg font-medium mt-4 mb-2">Candidatura</h3>
                  <div className="space-y-2">
                    <p><strong>Paese:</strong> {userInfo.paese_candidatura}</p>
                    <p><strong>Regione:</strong> {userInfo.regione_candidatura}</p>
                    <p><strong>Provincia:</strong> {userInfo.provincia_candidatura}</p>
                    <p><strong>Comune:</strong> {userInfo.comune_candidatura}</p>
                    <p><strong>Grado:</strong> {userInfo.grado_candidatura}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        {!isEditing && (
          <>
            {canEditImage && (
              <Button variant="outline" onClick={onModificaImmagine}>
                <Image className="mr-2 h-4 w-4" />
                Modifica Immagine
              </Button>
            )}
            <Button onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Modifica Profilo
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
