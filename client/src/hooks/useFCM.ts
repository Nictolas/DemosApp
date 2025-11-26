// Stub per FCM - sostituito con sistema Auth.js
export function useFCM() {
  return {
    token: null,
    isLoading: false,
    error: null,
    permission: null as NotificationPermission | null
  };
}
