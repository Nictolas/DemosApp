import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { CustomAvatar } from "@/components/CustomAvatar";
import { UserInfo } from "@/types/profile";

interface ProfileCandidatesProps {
  userInfo: UserInfo | null;
}

export function ProfileCandidates({ userInfo }: ProfileCandidatesProps) {
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [candidateAvatars, setCandidateAvatars] = useState<Record<string, any>>({});

  const fetchCandidateNames = async (userInfo: any) => {
    const candidates = {
      candidato_europeo: userInfo.candidato_europeo,
      candidato_camera: userInfo.candidato_camera,
      candidato_senato: userInfo.candidato_senato,
      candidato_regionale: userInfo.candidato_regione,
      candidato_comunale: userInfo.candidato_comune,
    };
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    for (const [key, uid] of Object.entries(candidates)) {
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
                console.error("Errore nel parsing dell'avatar del candidato:", error);
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
    setCandidateNames(names);
    setCandidateAvatars(avatars);
  };

  useEffect(() => {
    if (userInfo) {
      fetchCandidateNames(userInfo);
    }
  }, [userInfo]);

  if (!userInfo) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Candidati Selezionati</h3>
      
      {/* Candidato Europeo */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {candidateAvatars.candidato_europeo ? (
            <CustomAvatar config={candidateAvatars.candidato_europeo} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Europeo</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_europeo || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Camera */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {candidateAvatars.candidato_camera ? (
            <CustomAvatar config={candidateAvatars.candidato_camera} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Camera</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_camera || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Senato */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {candidateAvatars.candidato_senato ? (
            <CustomAvatar config={candidateAvatars.candidato_senato} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Senato</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_senato || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Regionale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {candidateAvatars.candidato_regionale ? (
            <CustomAvatar config={candidateAvatars.candidato_regionale} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Regionale</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_regionale || "Non selezionato"}</p>
        </div>
      </div>

      {/* Candidato Comunale */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12">
          {candidateAvatars.candidato_comunale ? (
            <CustomAvatar config={candidateAvatars.candidato_comunale} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Comunale</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_comunale || "Non selezionato"}</p>
        </div>
      </div>
    </div>
  );
}
