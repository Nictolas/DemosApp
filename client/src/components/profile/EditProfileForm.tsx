import React from "react";
import { UserInfo } from "@/types/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useProfileForm } from "./useProfileForm";
import { PersonalDataSection } from "./PersonalDataSection";
import { GeographicSection } from "./GeographicSection";

interface EditProfileFormProps {
  userData: UserInfo & { uid: string };
  onProfileUpdated: (updatedData: UserInfo) => void;
  onCancel: () => void;
}

export function EditProfileForm({ userData, onProfileUpdated, onCancel }: EditProfileFormProps) {
  const { formData, isSubmitting, handleChange, handleSubmit } = useProfileForm(userData, onProfileUpdated);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <PersonalDataSection 
            formData={formData} 
            onFieldChange={handleChange}
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
