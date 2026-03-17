export interface ProfileOpinion {
  id: string;
  label: string;
}

export interface CategorizedOpinions {
  favorevoli: ProfileOpinion[];
  indecisi: ProfileOpinion[];
  contrari: ProfileOpinion[];
}

export interface OpinionQuestion {
  id: string;
  text: string;
}

export interface ProfileState {
  userInfo: any | null;
  isLoadingInfo: boolean;
  error: string | null;
  isEditing: boolean;
  userOpinions: Record<string, string>;
  avatarConfig: any;
  governoIdeale: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
}

export interface ProfileActions {
  setUserInfo: (userInfo: any) => void;
  setIsLoadingInfo: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsEditing: (editing: boolean) => void;
  setUserOpinions: (opinions: Record<string, string>) => void;
  setAvatarConfig: (config: any) => void;
  setGovernoIdeale: (governo: Record<string, string>) => void;
  setOpinionQuestions: (questions: OpinionQuestion[]) => void;
}
