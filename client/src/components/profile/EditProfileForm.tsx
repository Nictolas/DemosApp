import React from "react";
import { UserInfo } from "../../pages/Profilo";
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

  // Determina se mostrare le sezioni in base al ruolo
  const shouldShowElectionSection = formData.ruolo === "Politico" || formData.ruolo === "Candidato Politico";
  const shouldShowCandidacySection = formData.ruolo === "Candidato" || formData.ruolo === "Candidato Politico";
  const shouldShowActivismSection = formData.ruolo === "Attivista" || formData.ruolo === "Admin";

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
              paese: formData.paese_residenza || "",
              regione: formData.regione_residenza || "",
              provincia: formData.provincia_residenza || "",
              comune: formData.comune_residenza || "",
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
                paese: formData.paese_elezione || "",
                regione: formData.regione_elezione || "",
                provincia: formData.provincia_elezione || "",
                comune: formData.comune_elezione || "",
                aula: formData.aula_elezione || "",
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
                paese: formData.paese_candidatura || "",
                regione: formData.regione_candidatura || "",
                provincia: formData.provincia_candidatura || "",
                comune: formData.comune_candidatura || "",
                aula: formData.aula_candidatura || "",
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
