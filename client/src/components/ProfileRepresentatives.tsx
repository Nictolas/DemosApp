import { useEffect, useState } from "react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { UserInfo } from "@/types/profile";

interface ProfileRepresentativesProps {
  userInfo: UserInfo | null;
}

export function ProfileRepresentatives({ userInfo }: ProfileRepresentativesProps) {
  const [representativeNames, setRepresentativeNames] = useState<Record<string, string>>({});
  const [representativeAvatars, setRepresentativeAvatars] = useState<Record<string, any>>({});

  const fetchRepresentativeNames = async (userInfo: any) => {
    const representatives = {
      rappresentante_europeo: userInfo.rappresentante_europeo,
      rappresentante_camera: userInfo.rappresentante_camera,
      rappresentante_senato: userInfo.rappresentante_senato,
      rappresentante_regionale: userInfo.rappresentante_regionale,
      rappresentante_comunale: userInfo.rappresentante_comunale,
    };
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    
    // Per ora, mostra solo i nomi se sono presenti nei dati utente
    // In futuro potremmo implementare una chiamata API per ottenere i dettagli completi
    for (const [key, value] of Object.entries(representatives)) {
      if (value && typeof value === 'string') {
        names[key] = value; // Usa direttamente il valore se è già un nome
      } else {
        names[key] = "Non selezionato";
      }
    }
    
    setRepresentativeNames(names);
    setRepresentativeAvatars(avatars);
  };

  useEffect(() => {
    if (userInfo) {
      fetchRepresentativeNames(userInfo);
    }
  }, [userInfo]);

  if (!userInfo) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Rappresentanti Selezionati</h3>
      
      {/* Rappresentante Europeo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_europeo ? (
            <CustomAvatar config={representativeAvatars.rappresentante_europeo} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Europeo</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_europeo || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Camera */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_camera ? (
            <CustomAvatar config={representativeAvatars.rappresentante_camera} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Camera</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_camera || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Senato */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_senato ? (
            <CustomAvatar config={representativeAvatars.rappresentante_senato} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Senato</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_senato || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Regionale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_regionale ? (
            <CustomAvatar config={representativeAvatars.rappresentante_regionale} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Regionale</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_regionale || "Non selezionato"}</p>
        </div>
      </div>

      {/* Rappresentante Comunale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {representativeAvatars.rappresentante_comunale ? (
            <CustomAvatar config={representativeAvatars.rappresentante_comunale} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Rappresentante Comunale</p>
          <p className="text-sm text-gray-600">{representativeNames.rappresentante_comunale || "Non selezionato"}</p>
        </div>
      </div>
    </div>
  );
}
