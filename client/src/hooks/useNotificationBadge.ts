import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import {
  fetchNotificationFeed,
  isValidNotificationUserId,
  notificationFeedKey,
  notificationFeedQueryPolicy,
} from "@/lib/notificationFeed";
import type { NotificheData } from "@/pages/Notifiche/types";

export const useNotificationBadge = () => {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<NotificheData>({
    queryKey: notificationFeedKey(user?.id),
    queryFn: fetchNotificationFeed,
    enabled: isValidNotificationUserId(user?.id),
    ...notificationFeedQueryPolicy,
  });

  const notifications = data?.notifiche ?? [];
  // Many legacy notification sources have no read/unread state at all.
  // Count explicit unread entries only; do NOT label every missing status as unread.
  const unreadCount = notifications.filter(n => n.status === "non_letta").length;
  const notificationCount = notifications.length;
  const hasReliableReadState = notifications.every(n =>
    n.status === "letta" || n.status === "non_letta"
  );

  return {
    unreadCount,
    notificationCount,
    hasReliableReadState: data ? hasReliableReadState : false,
    isLoading,
  };
};
