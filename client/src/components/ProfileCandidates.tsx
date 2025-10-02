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
    console.log('🔍 DEBUG ProfileCandidates - userInfo:', userInfo);
    console.log('🔍 DEBUG ProfileCandidates - candidatiDetails:', candidatiDetails);
    
    const candidates = {
      candidato_europeo: userInfo.candidato_europeo,
      candidato_camera: userInfo.candidato_camera,
      candidato_senato: userInfo.candidato_senato,
      candidato_regionale: userInfo.candidato_regionale,
      candidato_comune: userInfo.candidato_comune,
    };
    console.log('🔍 DEBUG ProfileCandidates - candidates IDs:', candidates);
    
    const names: Record<string, string> = {};
    const avatars: Record<string, any> = {};
    
    // Mappa delle categorie per i dettagli
    const categoryMap: Record<string, string> = {
      'candidato_europeo': 'europeo',
      'candidato_camera': 'camera',
      'candidato_senato': 'senato',
      'candidato_regionale': 'regione',  // Corretto: era 'regionale'
      'candidato_comune': 'comune'
    };
    
    for (const [key, value] of Object.entries(candidates)) {
      console.log(`🔍 DEBUG ProfileCandidates - Processing ${key}:`, value);
      
      if (value && typeof value === 'string') {
        // Cerca nei dettagli completi
        const category = categoryMap[key];
        console.log(`🔍 DEBUG ProfileCandidates - Category for ${key}:`, category);
        console.log(`🔍 DEBUG ProfileCandidates - candidatiDetails[${category}]:`, candidatiDetails?.[category]);
        
        if (candidatiDetails && candidatiDetails[category] && candidatiDetails[category].length > 0) {
          // Cerca il candidato con l'ID corrispondente
          const candidate = candidatiDetails[category].find((c: any) => c.id === value);
          if (candidate) {
            console.log(`🔍 DEBUG ProfileCandidates - Found candidate for ${key}:`, candidate);
            names[key] = `${candidate.nome} ${candidate.cognome}`;
            if (candidate.avatar_config) {
              try {
                avatars[key] = JSON.parse(candidate.avatar_config);
              } catch (e) {
                avatars[key] = null;
              }
            }
          } else {
            console.log(`🔍 DEBUG ProfileCandidates - Candidate with ID ${value} not found in ${category}`);
            names[key] = "Non selezionato";
          }
        } else {
          console.log(`🔍 DEBUG ProfileCandidates - No details found for ${key}, setting as not selected`);
          names[key] = "Non selezionato";
        }
      } else {
        console.log(`🔍 DEBUG ProfileCandidates - No value for ${key}, setting as not selected`);
        names[key] = "Non selezionato";
      }
    }
    
    console.log('🔍 DEBUG ProfileCandidates - Final names:', names);
    console.log('🔍 DEBUG ProfileCandidates - Final avatars:', avatars);
    
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
          {candidateAvatars.candidato_comune ? (
            <CustomAvatar config={candidateAvatars.candidato_comune} size={48} />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-500 text-xs">N/A</span>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Candidato Comunale</p>
          <p className="text-sm text-gray-600">{candidateNames.candidato_comune || "Non selezionato"}</p>
        </div>
      </div>
    </div>
  );
}
