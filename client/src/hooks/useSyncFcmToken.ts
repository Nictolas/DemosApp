import { useEffect } from "react";
// Firebase/Firestore rimossi - hook disabilitato
// import { doc, updateDoc } from "firebase/firestore";
// import { db } from "@/lib/firebase-stub";
import { useAuth } from "@/hooks/use-auth-neon";
// import { useFCM } from "@/hooks/useFCM";

export function useSyncFcmToken() {
  const { user } = useAuth();
  // const { token: fcmToken } = useFCM();

  useEffect(() => {
    // FCM token sync disabilitato durante la migrazione
    // TODO: Implementare sistema notifiche nativo se necessario
    console.log('useSyncFcmToken: Hook disabilitato durante migrazione da Firebase');
  }, [user]);
} 
