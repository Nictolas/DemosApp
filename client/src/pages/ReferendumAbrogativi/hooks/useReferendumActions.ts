import { useState } from "react";
import type { Referendum, ReferendumAbrogativiState } from "../types";

// Read-only official referendum page: no proposal or priority-vote mutations.
export const useReferendumActions = () => {
  const [state, setState] = useState<ReferendumAbrogativiState>({
    showForm: false,
    editReferendum: null,
    viewReferendum: null,
  });
  const startEditView = (referendum: Referendum) =>
    setState(prev => ({...prev, viewReferendum: referendum}));
  const closeView = () =>
    setState(prev => ({...prev, viewReferendum: null}));

  return {state, startEditView, closeView};
};
