import { useState } from "react";
import { Referendum } from "../types";

export const useReferendumActions = () => {
  const [viewReferendum, setViewReferendum] = useState<Referendum | null>(null);

  const startEditView = (referendum: Referendum) => setViewReferendum(referendum);
  const closeView = () => setViewReferendum(null);

  return {
    state: {
      showForm: false,
      editReferendum: null,
      viewReferendum,
    },
    startEditView,
    closeView,
  };
};
