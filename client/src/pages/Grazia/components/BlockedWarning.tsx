import React from "react";
import { formatUnlockDate } from "../utils/graziaUtils";

interface BlockedWarningProps {
  unlockDate?: string;
}

export const BlockedWarning: React.FC<BlockedWarningProps> = ({ unlockDate }) => {
  const formattedDate = formatUnlockDate(unlockDate);
  
  return (
    <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-sm">
      <b>Hai già modificato le richieste questa settimana.</b><br />
      Potrai farlo di nuovo dal: {formattedDate || "-"}
    </div>
  );
};
