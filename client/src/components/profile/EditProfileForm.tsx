import React from "react";
import { UserInfo } from "@/types/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useProfileForm } from "./useProfileForm";
import { PersonalDataSection } from "./PersonalDataSection";
import { GeographicSection } from "./GeographicSection";
import { ActivismTypesSection } from "./ActivismTypesSection";

interface EditProfileFormProps {
  userData: UserInfo & { uid: string };
  onProfileUpdated: (updatedData: UserInfo) => void;
  onCancel: () => void;
  isAdmin?: boolean;
}

export function EditProfileForm({ userData, onProfileUpdated, onCancel, isAdmin = false }: EditProfileFormProps) {
  const { formData, isSubmitting, handleChange, handleSubmit } = useProfileForm(userData, onProfileUpdated, isAdmin);

  // Debug logging per verificare i dati ricevuti
  console.log('🔍 DEBUG EditProfileForm - userData ricevuto:', userData);
  console.log('🔍 DEBUG EditProfileForm - formData dopo useProfileForm:', formData);
  console.log('🔍 DEBUG EditProfileForm - Dati geografici formData:', {
    paese_residenza: formData.paese_residenza,
    regione_residenza: formData.regione_residenza,
    provincia_residenza: formData.provincia_residenza,
    comune_residenza: formData.comune_residenza,
    paese_elezione: formData.paese_elezione,
    regione_elezione: formData.regione_elezione,
    provincia_elezione: formData.provincia_elezione,
    comune_elezione: formData.comune_elezione,
    paese_candidatura: formData.paese_candidatura,
    regione_candidatura: formData.regione_candidatura,
    provincia_candidatura: formData.provincia_candidatura,
    comune_candidatura: formData.comune_candidatura
  });

  // Determina se mostrare le sezioni in base al ruolo
  // Se è un admin che modifica un utente, mostra sempre tutte le sezioni
  const shouldShowElectionSection = isAdmin || formData.ruolo === "P" || formData.ruolo === "CP";
  const shouldShowCandidacySection = isAdmin || formData.ruolo === "C" || formData.ruolo === "CP";
  const shouldShowActivismSection = isAdmin || formData.ruolo === "A" || formData.ruolo === "AD";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <PersonalDataSection 
            formData={formData} 
            onFieldChange={handleChange}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <GeographicSection
            title="Residenza"
            prefix="residenza"
            initialData={{
              paese_residenza: formData.paese_residenza || "",
              regione_residenza: formData.regione_residenza || "",
              provincia_residenza: formData.provincia_residenza || "",
              comune_residenza: formData.comune_residenza || "",
            }}
            onFieldChange={(field, value) => handleChange(field as keyof (UserInfo & { uid: string }), value)}
          />
        </CardContent>
      </Card>

      {shouldShowElectionSection && (
        <Card>
          <CardContent className="p-6">
            <GeographicSection
              title="Elezione"
              prefix="elezione"
              initialData={{
                paese_elezione: formData.paese_elezione || "",
                regione_elezione: formData.regione_elezione || "",
                provincia_elezione: formData.provincia_elezione || "",
                comune_elezione: formData.comune_elezione || "",
                aula_elezione: formData.aula_elezione || "",
              }}
              onFieldChange={(field, value) => handleChange(field as keyof (UserInfo & { uid: string }), value)}
              showAula={true}
              gradoValue={formData.grado_elezione || ""}
              onGradoChange={(value) => handleChange("grado_elezione", value)}
            />
          </CardContent>
        </Card>
      )}

      {shouldShowCandidacySection && (
        <Card>
          <CardContent className="p-6">
            <GeographicSection
              title="Candidatura"
              prefix="candidatura"
              initialData={{
                paese_candidatura: formData.paese_candidatura || "",
                regione_candidatura: formData.regione_candidatura || "",
                provincia_candidatura: formData.provincia_candidatura || "",
                comune_candidatura: formData.comune_candidatura || "",
                aula_candidatura: formData.aula_candidatura || "",
              }}
              onFieldChange={(field, value) => handleChange(field as keyof (UserInfo & { uid: string }), value)}
              showAula={true}
              gradoValue={formData.grado_candidatura || ""}
              onGradoChange={(value) => handleChange("grado_candidatura", value)}
            />
          </CardContent>
        </Card>
      )}

      {shouldShowActivismSection && (
        <ActivismTypesSection
          initialTypes={formData.tipologie_attivismo || []}
          onTypesChange={(types) => handleChange("tipologie_attivismo", types)}
          disabled={isSubmitting}
        />
      )}

      <div className="flex justify-end space-x-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aggiornamento...
            </>
          ) : (
            "Aggiorna Profilo"
          )}
        </Button>
      </div>
    </form>
  );
}
