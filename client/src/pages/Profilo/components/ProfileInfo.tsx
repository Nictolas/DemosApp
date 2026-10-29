import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Edit, MapPin, User } from "lucide-react";
import { UserInfo } from "@/types/profile";
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

  // Tutti gli account possono riconoscere e modificare il proprio avatar.
  const canShowAvatar = true;
  const canShowFullName = ["P", "Politico", "C", "Candidato", "CP", "Candidato Politico"].includes(userInfo.ruolo);

  const fullName = userInfo.nome_completo ||
    [userInfo.nome, userInfo.cognome].filter(Boolean).join(" ") || "Nome non disponibile";

  // La data completa non va mostrata: basta l'anno.
  const birthYear = (() => {
    if (!userInfo.data_nascita) return "Non specificato";
    const value = String(userInfo.data_nascita).trim();
    if (/^\d{4}$/.test(value)) return value;
    // L'API /users/me usa DD/MM/YYYY per le date complete: Date.parse non lo supporta.
    const italianDate = value.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/);
    if (italianDate) return italianDate[1];
    const isoDate = value.match(/^(\d{4})-\d{2}-\d{2}/);
    if (isoDate) return isoDate[1];
    return "Non specificato";
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
              {isOwnProfile ? (canShowFullName ? fullName : "Il mio profilo") : (canShowFullName ? fullName : "Profilo pubblico")}
            </h2>
            {isOwnProfile ? (
              <>
                <div className="mt-1 flex min-w-0 items-center gap-1">
                  <p className="min-w-0 flex-1 break-words text-sm text-slate-600">
                    {birthYear !== "Non specificato" ? `Nascita: ${birthYear}` : "Anno di nascita non specificato"}
                    {userInfo.cittadinanza ? ` · ${userInfo.cittadinanza}` : ""}
                  </p>
                  {canEdit && !isEditing && (
                    <button
                      type="button"
                      onClick={onEditClick}
                      aria-label="Modifica profilo"
                      title="Modifica profilo"
                      data-testid="profilo-modifica-icon"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-indigo-100 text-indigo-700 transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                      <Edit aria-hidden="true" className="h-4 w-4" />
                    </button>
                  )}
                </div>
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
