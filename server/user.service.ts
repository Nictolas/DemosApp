import { db } from './firebase-config';
import { collection, doc, getDoc, setDoc, query, where, limit, getDocs } from 'firebase/firestore';
import { FirebaseService } from './firebase-service';
import { Utente, UserOpinions } from './types';

class UserService extends FirebaseService {
  public static async saveUserData(userData: Utente): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      if (!db || !userData.email) return { success: false, error: "DB non conf. o email mancante" };

      const emailId = this.emailToId(userData.email);
      const userDocRef = doc(db, 'utenti', emailId);

      const dataToSave = { ...userData, id: emailId, updatedAt: new Date().toISOString() };
      if (!dataToSave.createdAt) dataToSave.createdAt = new Date().toISOString();

      await setDoc(userDocRef, dataToSave, { merge: true });
      return { success: true, data: dataToSave };
    } catch (error) {
      return this.handleError(error, 'saveUserData');
    }
  }

  public static async getUserByEmail(email: string): Promise<Utente | null> {
    try {
      if (!db) return null;
      const emailId = this.emailToId(email);
      const userDocRef = doc(db, 'utenti', emailId);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() } as Utente;

      const q = query(collection(db, 'utenti'), where('email', '==', email), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Utente;

      return null;
    } catch (error) {
      this.handleError(error, 'getUserByEmail');
      return null;
    }
  }

  public static async saveUserOpinions(userEmail: string, opinions: UserOpinions): Promise<{ success: boolean; data?: any; error?: string; }> {
     try {
        if (!db) return { success: false, error: "DB non configurato" };
        const emailId = this.emailToId(userEmail);
        const userDocRef = doc(db, 'utenti', emailId);
        const opinionsToSave = { ...opinions, updatedAt: new Date().toISOString() };
        await setDoc(userDocRef, opinionsToSave, { merge: true });
        return { success: true, data: opinionsToSave };
    } catch (error) {
        return this.handleError(error, 'saveUserOpinions');
    }
  }
}

export default UserService;