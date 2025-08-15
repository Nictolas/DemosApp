import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase-stub";
import { useAuth } from "@/hooks/use-auth-neon";
import { useFCM } from "@/hooks/useFCM";

export function useSyncFcmToken() {
  const { user } = useAuth();
  const { token: fcmToken } = useFCM();

  useEffect(() => {
    if (user && fcmToken) {
      const userRef = doc(db, "utenti", user.uid);
      // Sovrascrive l’array con SOLO il token attivo
      updateDoc(userRef, { fcmTokens: [fcmToken] }).catch((err) => {
        console.error("Errore aggiornamento fcmTokens su Firestore:", err);
      });
    }
  }, [user, fcmToken]);
} 