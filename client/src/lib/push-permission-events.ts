// No token, user ID or preference value is included in this event.
// Each hook owns independent local React state, so another mounted instance
// must be able to re-read the OS/browser permission after a user action.
export const PUSH_PERMISSION_CHANGED_EVENT = 'demos:push-permission-changed';

export function notifyPushPermissionChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PUSH_PERMISSION_CHANGED_EVENT));
  }
}
