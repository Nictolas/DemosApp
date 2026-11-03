import { apiRequest } from "@/lib/queryClient";
import type { NotificheData } from "@/pages/Notifiche/types";

// The server identifies the owner from the verified JWT, never the URL.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidNotificationUserId = (id: unknown): id is string =>
  typeof id === "string" && UUID_PATTERN.test(id);

// One user-scoped React Query entry is shared between the page and its badge.
// Keeping the user id only in memory prevents a stale account's feed from being
// shown to the next account and avoids leaking the identifier via request URLs.
export const notificationFeedKey = (userId?: string | null) =>
  ["notifiche", userId ?? null] as const;

export async function fetchNotificationFeed(): Promise<NotificheData> {
  const response = await apiRequest("GET", "/api/notifiche");
  const payload = response?.data;

  if (!response?.ok || payload?.success !== true || !Array.isArray(payload?.notifiche)) {
    throw new Error("Impossibile caricare le notifiche");
  }

  return payload as NotificheData;
}

export const notificationFeedQueryPolicy = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  staleTime: 90_000,
  refetchOnWindowFocus: true,
  retry: false,
} as const;
