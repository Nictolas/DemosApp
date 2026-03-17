export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordChangeState {
  isChangingPassword: boolean;
  showChangePassword: boolean;
}

export interface LogoutState {
  isLoggingOut: boolean;
  showLogoutDialog: boolean;
}
