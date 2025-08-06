import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { CustomAvatar } from "@/components/CustomAvatar";
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
    for (const [key, uid] of Object.entries(representatives)) {
      if (uid && typeof uid === 'string') {
        try {
          const response = await apiRequest("GET", `/api/users/${encodeURIComponent(uid)}`);
          if (response.ok) {
            const userData = await response.json();
            names[key] = `${userData.nome} ${userData.cognome}`;
            if (userData.avatar_config) {
              try {
                const avatarConfig = JSON.parse(userData.avatar_config);
                const updatedConfig = {
                  skinColor: avatarConfig.skinColor || "#FDBCB4",
                  hairColor: avatarConfig.hairColor || "#8B4513",
                  hairStyle: avatarConfig.hairStyle || "short",
                  mustacheStyle: avatarConfig.mustacheStyle || (avatarConfig.mustache ? "classic" : "none"),
                  mustacheColor: avatarConfig.mustacheColor || "#2C1810",
                  beardStyle: avatarConfig.beardStyle || "none",
                  beardColor: avatarConfig.beardColor || "#2C1810",
                  noseStyle: avatarConfig.noseStyle || "normal",
                  suitColor: avatarConfig.suitColor || "#2C3E50",
                  tieColor: avatarConfig.tieColor || "#E74C3C"
                };
                avatars[key] = updatedConfig;
              } catch (error) {
                console.error("Errore nel parsing dell'avatar del rappresentante:", error);
              }
            }
          } else {
            names[key] = "Non selezionato";
          }
        } catch (error) {
          console.error(`Errore nel recupero dati per ${uid}:`, error);
          names[key] = "Non selezionato";
        }
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
