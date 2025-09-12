import { useEffect, useState } from "react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";
import { UserInfo } from "@/types/profile";

interface ProfileCandidatesProps {
  userInfo: UserInfo | null;
  candidatiDetails?: Record<string, any>;
}

export function ProfileCandidates({ userInfo, candidatiDetails }: ProfileCandidatesProps) {
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [candidateAvatars, setCandidateAvatars] = useState<Record<string, any>>({});

  const fetchCandidateNames = async (userInfo: any) => {
    const candidates = {
      candidato_europeo: userInfo.candidato_europeo,
      candidato_camera: userInfo.candidato_camera,
      candidato_senato: userInfo.candidato_senato,
      candidato_regionale: userInfo.candidato_regionale,
      candidato_comune: userInfo.candidato_comune,
    };
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    
    // Mappa delle categorie per i dettagli
    const categoryMap: Record<string, string> = {
      'candidato_europeo': 'europeo',
      'candidato_camera': 'camera',
      'candidato_senato': 'senato',
      'candidato_regionale': 'regionale',
      'candidato_comune': 'comune'
    };
    
    for (const [key, value] of Object.entries(candidates)) {
      if (value && typeof value === 'string') {
        // Cerca nei dettagli completi
        const category = categoryMap[key];
        if (candidatiDetails && candidatiDetails[category] && candidatiDetails[category].length > 0) {
          const candidate = candidatiDetails[category][0];
          names[key] = `${candidate.nome} ${candidate.cognome}`;
          if (candidate.avatar_config) {
            try {
              avatars[key] = JSON.parse(candidate.avatar_config);
            } catch (e) {
              avatars[key] = null;
            }
          }
        } else {
          names[key] = value; // Usa l'ID se non troviamo i dettagli
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
  }, [userInfo, candidatiDetails]);

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
