import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useFCM } from "@/hooks/useFCM";

export function useSyncFcmToken() {
  const { user } = useAuth();
  const { token: fcmToken } = useFCM();

  useEffect(() => {
    if (user && fcmToken) {
      const userRef = doc(db, "utenti", user.uid);
      updateDoc(userRef, { fcmToken }).catch((err) => {
        console.error("Errore aggiornamento fcmToken su Firestore:", err);
      });
    }
  }, [user, fcmToken]);
} 