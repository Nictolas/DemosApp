import React from "react";

interface BlockedWarningProps {
  unlockDate?: string;
}

export const BlockedWarning: React.FC<BlockedWarningProps> = ({ unlockDate }) => {
  const unlockDateFormatted = unlockDate ? new Date(unlockDate).toLocaleString('it-IT') : null;

  return (
    <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-sm">
      <b>Hai già modificato i voti questa settimana.</b><br />
      Potrai modificarli di nuovo dal: {unlockDateFormatted || "-"}
    </div>
  );
};

