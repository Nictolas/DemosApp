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

export interface ProfileHeaderProps {
  fromGestisciUtenti: boolean;
  userId?: string;
  onBack: () => void;
}

export interface ProfileInfoProps {
  userInfo: any;
  isEditing: boolean;
  onEdit: () => void;
  onModificaImmagine: () => void;
  canEditImage: boolean;
}

export interface ProfileOpinionsProps {
  userOpinions: Record<string, string>;
  opinionQuestions: OpinionQuestion[];
}

export interface ProfileGovernmentProps {
  governoIdeale: Record<string, string>;
}

export interface ProfileLoadingProps {
  isLoading: boolean;
  isLoadingInfo: boolean;
}

export interface ProfileErrorProps {
  error: string | null;
  onRetry: () => void;
}
