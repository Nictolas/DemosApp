import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Upload, Loader2 } from "lucide-react";
import { ClaimFormData, ClaimDocuments, PoliticianProfile } from "../types";

interface ClaimFormProps {
  formData: ClaimFormData;
  documents: ClaimDocuments;
  selectedProfile: PoliticianProfile | null;
  onInputChange: (field: keyof ClaimFormData, value: string | boolean) => void;
  onFileUpload: (field: keyof ClaimDocuments, file: File | null) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export const ClaimForm: React.FC<ClaimFormProps> = ({
  formData,
  documents,
  selectedProfile,
  onInputChange,
  onFileUpload,
  onSubmit,
  onBack,
  isSubmitting
}) => {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Fase 2 - Compila i dati
        </CardTitle>
        {selectedProfile && (
          <CardDescription>
            Stai reclamando il profilo di: <strong>{selectedProfile.nome} {selectedProfile.cognome}</strong>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Info */}
        <div className="space-y-4">
          <h4 className="font-medium">Dati Personali</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => onInputChange("nome", e.target.value)}
                placeholder="Il tuo nome"
              />
            </div>
            <div>
              <Label htmlFor="cognome">Cognome *</Label>
              <Input
                id="cognome"
                value={formData.cognome}
                onChange={(e) => onInputChange("cognome", e.target.value)}
                placeholder="Il tuo cognome"
              />
            </div>
          </div>
        </div>

        {/* Professional Info */}
        <div className="space-y-4">
          <h4 className="font-medium">Informazioni Professionali</h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="carica_attuale">Carica Attuale *</Label>
              <Input
                id="carica_attuale"
                value={formData.carica_attuale}
                onChange={(e) => onInputChange("carica_attuale", e.target.value)}
                placeholder="es. Sindaco, Consigliere Regionale, Deputato"
              />
            </div>
            <div>
              <Label htmlFor="ente_elettorale">Ente Elettorale *</Label>
              <Input
                id="ente_elettorale"
                value={formData.ente_elettorale}
                onChange={(e) => onInputChange("ente_elettorale", e.target.value)}
                placeholder="es. Comune di Roma, Regione Lazio, Parlamento"
              />
            </div>
            <div>
              <Label htmlFor="email">Recapito E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => onInputChange("email", e.target.value)}
                placeholder="Il tuo indirizzo email"
              />
            </div>
            <div>
              <Label htmlFor="riferimento_istituzionale">Riferimento Istituzionale</Label>
              <Textarea
                id="riferimento_istituzionale"
                value={formData.riferimento_istituzionale}
                onChange={(e) => onInputChange("riferimento_istituzionale", e.target.value)}
                placeholder="Link al sito ufficiale o contatto dell'ufficio elettorale"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div className="space-y-4">
          <h4 className="font-medium">Upload Documenti *</h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="documento_identita">Documento di identità ufficiale *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Carta d'identità o passaporto in corso di validità (fronte/retro)
              </p>
              <Input
                id="documento_identita"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => onFileUpload("documento_identita", e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label htmlFor="certificazione_elezione">Certificazione di elezione *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Copia del verbale di proclamazione o estratto ufficiale
              </p>
              <Input
                id="certificazione_elezione"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => onFileUpload("certificazione_elezione", e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label htmlFor="dichiarazione_carica">Dichiarazione di carica *</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Autocertificazione su carta semplice con carica attuale e data di inizio mandato
              </p>
              <Input
                id="dichiarazione_carica"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => onFileUpload("dichiarazione_carica", e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>

        {/* GDPR Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="gdpr"
            checked={formData.gdpr_accepted}
            onCheckedChange={(checked) => onInputChange("gdpr_accepted", !!checked)}
          />
          <Label htmlFor="gdpr" className="text-sm">
            Accetto i termini, le condizioni e la{" "}
            <a href="/privacy-policy" className="text-primary hover:underline">
              Privacy Policy di Demos
            </a>
            *
          </Label>
        </div>

        {/* Submit Button */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onBack}
          >
            Indietro
          </Button>
          <Button 
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            Invia richiesta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
