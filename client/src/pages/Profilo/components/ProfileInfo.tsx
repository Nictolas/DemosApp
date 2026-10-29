import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, Edit, Heart, MapPin, User } from "lucide-react";
import { UserInfo } from "@/types/profile";
import { TIPOLOGIE_ATTIVISMO } from "@/constants/attivismo-types";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

interface ProfileInfoProps {
  userInfo: UserInfo;
  isEditing: boolean;
  onEditClick: () => void;
  onModificaImmagine: () => void;
  canEdit?: boolean;
  isOwnProfile?: boolean;
  avatarConfig?: any;
}

export const ProfileInfo = ({
  userInfo,
  isEditing,
  onEditClick,
  onModificaImmagine,
  canEdit = true,
  isOwnProfile = true,
  avatarConfig,
}: ProfileInfoProps) => {
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);

  const canShowAvatar = ["P", "Politico", "C", "Candidato", "CP", "Candidato Politico", "AD", "Admin"].includes(userInfo.ruolo);
  const canShowFullName = ["P", "Politico", "C", "Candidato", "CP", "Candidato Politico"].includes(userInfo.ruolo);

  const fullName = userInfo.nome_completo ||
    [userInfo.nome, userInfo.cognome].filter(Boolean).join(" ") || "Nome non disponibile";

  // La data completa non va mostrata: basta l'anno.
  const birthYear = (() => {
    if (!userInfo.data_nascita) return "Non specificato";
    const value = String(userInfo.data_nascita).trim();
    if (/^\d{4}$/.test(value)) return value;
    const year = new Date(value).getFullYear();
    return Number.isFinite(year) ? String(year) : "Non specificato";
  })();

  const parsedAvatar = (() => {
    if (!avatarConfig) return null;
    try {
      let parsed = typeof avatarConfig === "string" ? JSON.parse(avatarConfig) : avatarConfig;
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  })();

  const locationSummary = [
    userInfo.comune_residenza,
    userInfo.provincia_residenza,
  ].filter(Boolean).join(", ");

  const detailRows = [
    ...(canShowFullName ? [["Nome completo", fullName], ["Sesso", userInfo.sesso || userInfo.genere]] : []),
    ["Anno di nascita", birthYear],
    ["Cittadinanza", userInfo.cittadinanza],
    ["Paese", userInfo.paese_residenza],
    ["Regione", userInfo.regione_residenza],
    ["Provincia", userInfo.provincia_residenza],
    ["Comune", userInfo.comune_residenza],
    ["Professione", userInfo.professione],
    ["Istruzione", userInfo.istruzione],
    ["Telefono", userInfo.telefono],
  ].filter(([_, value]) => value !== null && value !== undefined && String(value).trim() !== "");

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {canShowAvatar && (
            <div className="relative shrink-0">
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setShowAvatarDialog(true)}
                  className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label="Modifica avatar"
                >
                  {parsedAvatar ? <CustomAvatar config={parsedAvatar} size={68} /> : <User className="h-9 w-9 text-slate-500" />}
                </button>
              ) : (
                <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50">
                  {parsedAvatar ? <CustomAvatar config={parsedAvatar} size={68} /> : <User className="h-9 w-9 text-slate-500" />}
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-tight text-slate-900">
              {isOwnProfile ? (canShowFullName ? fullName : "Il mio profilo") : fullName}
            </h2>
            {isOwnProfile ? (
              <>
                <p className="mt-1 text-sm text-slate-600">
                  {birthYear !== "Non specificato" ? `Nato nel ${birthYear}` : "Anno di nascita non specificato"}
                  {userInfo.cittadinanza ? ` · ${userInfo.cittadinanza}` : ""}
                </p>
                {locationSummary && (
                  <p className="mt-1 flex items-start gap-1 text-sm text-slate-600">
                    <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{locationSummary}</span>
                  </p>
                )}
                {userInfo.regione_residenza && (
                  <p className="mt-0.5 text-xs text-slate-500">{userInfo.regione_residenza}</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Profilo pubblico</p>
            )}
          </div>
        </div>

        {isOwnProfile && (
          <details className="group mt-3 border-t border-slate-100 pt-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md py-1 text-sm font-medium text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
              Dati personali completi
              <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {detailRows.map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            {(userInfo.ruolo === "A" || userInfo.ruolo === "AD") &&
              Array.isArray(userInfo.tipologie_attivismo) && userInfo.tipologie_attivismo.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Heart aria-hidden="true" className="h-4 w-4" /> Tipologie di attivismo
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {userInfo.tipologie_attivismo.map((tipo) => {
                      const match = TIPOLOGIE_ATTIVISMO.find((t) => t.tipo === tipo);
                      if (!match) return null;
                      return <Badge key={tipo} variant="secondary">{match.nome}</Badge>;
                    })}
                  </div>
                </div>
              )}
          </details>
        )}

        {canEdit && !isEditing && (
          <Button
            type="button"
            onClick={onEditClick}
            variant="outline"
            className="mt-3 h-9 w-full gap-2 rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Edit aria-hidden="true" className="h-4 w-4" />
            Modifica profilo
          </Button>
        )}
      </CardContent>

      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Modifica avatar</DialogTitle>
            <DialogDescription>Vuoi modificare il tuo avatar?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAvatarDialog(false)}>Annulla</Button>
            <Button onClick={() => { setShowAvatarDialog(false); onModificaImmagine(); }}>Conferma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
