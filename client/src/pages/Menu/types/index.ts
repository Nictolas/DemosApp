export interface User {
  role?: string;
  ruolo?: string;
  [key: string]: any;
}

export interface MenuButtonProps {
  path: string;
  icon: React.ComponentType<any>;
  label: string;
  color: {
    bg: string;
    icon: string;
  };
  onNavigate: (path: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export interface MenuData {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  hasAdvancedAccess: boolean;
}
