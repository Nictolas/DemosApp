import React from "react";
import { CustomAvatar } from "@/components/avatar/CustomAvatar";

interface GovernmentVoteNameProps {
  name: string;
  avatarPerNome?: Record<string, any>;
}

export const GovernmentVoteName: React.FC<GovernmentVoteNameProps> = ({ name, avatarPerNome }) => {
  // Keys correspond to the normalized display names returned by /api/governo/voti.
  const key = name.trim().replace(/\s+/g, " ").toLowerCase();
  const avatar = avatarPerNome?.[key];

  return (
    <div className="flex items-center gap-2 min-w-0">
      {avatar && (
        <div className="shrink-0" aria-hidden="true">
          <CustomAvatar config={avatar} size={32} className="rounded-full" />
        </div>
      )}
      <span className="text-sm font-medium text-gray-900 break-words min-w-0">{name}</span>
    </div>
  );
};
