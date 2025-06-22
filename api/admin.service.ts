// Import della classe base e delle configurazioni con l'estensione .js
import { FirebaseService } from './firebase-service.js';
import { adminDb } from './firebase-config.js';

// Import necessari da 'firebase/firestore'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';

class AdminService extends FirebaseService {

  // =========================================================
  // METODI GESTIONE UTENTI (Approvazione/Rifiuto/Eliminazione)
  // =========================================================

  /**
   * Elimina un utente da Firestore tramite email.
   * @param email L'email dell'utente da eliminare.
   */
  public static async deleteUserByEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: "Database non configurato" };
      const emailId = this.emailToId(email);
      const userDocRef = adminDb.collection('utenti').doc(emailId);
      await userDocRef.delete();
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteUserByEmail`);
    }
  }

  /**
   * Recupera tutti gli utenti con stato "pending".
   */
  public static async getPendingUsers(): Promise<any[]> {
    try {
      if (!adminDb) return [];
      const q = adminDb.collection('utenti').where('status', '==', 'pending');
      const snapshot = await q.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getPendingUsers');
      return [];
    }
  }

  /**
   * Approva un utente cambiando il suo stato in "active".
   */
  public static async approveUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: 'Database non disponibile' };
      const userRef = adminDb.collection('utenti').doc(userId);
      await userRef.update({ status: 'active', approved_at: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'approveUser');
    }
  }

  /**
   * Rifiuta un utente, inviando una notifica e cancellando il documento.
   */
  public static async rejectUser(userId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: 'Database non disponibile' };
      const userDoc = await adminDb.collection('utenti').doc(userId).get();
      if (userDoc.exists) {
        await adminDb.collection('user_notifications').add({
          user_id: userId,
          type: 'account_rejected',
          title: 'Account rifiutato',
          message: reason || 'La tua richiesta di account è stata rifiutata.',
          created_at: new Date().toISOString()
        });
      }
      await adminDb.collection('utenti').doc(userId).delete();
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectUser');
    }
  }

  // =========================================================
  // METODI GESTIONE RICHIESTE (Premium, Claim Profilo)
  // =========================================================

  public static async getPendingPremiumRequests(): Promise<any[]> {
    try {
      if (!adminDb) return [];
      const q = adminDb.collection('premium_requests').where('status', '==', 'pending');
      const snapshot = await q.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getPendingPremiumRequests');
      return [];
    }
  }

  public static async approvePremiumRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: 'Database non disponibile' };
      const requestDoc = await adminDb.collection('premium_requests').doc(requestId).get();
      if (!requestDoc.exists) return { success: false, error: 'Richiesta non trovata' };
      const requestData = requestDoc.data();
      if (!requestData || !requestData.user_email) return { success: false, error: 'Dati richiesta non validi' };
      const userRef = adminDb.collection('utenti').doc(this.emailToId(requestData.user_email));
      await userRef.update({ premium: true, premium_activated_at: new Date().toISOString() });
      await adminDb.collection('premium_requests').doc(requestId).update({ status: 'approved', approved_at: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'approvePremiumRequest');
    }
  }

  public static async rejectPremiumRequest(requestId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!adminDb) return { success: false, error: 'Database non disponibile' };
      await adminDb.collection('premium_requests').doc(requestId).update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectPremiumRequest');
    }
  }

  public static async saveProfileClaimRequest(claimData: any): Promise<{ success: boolean; error?: string }> {
    return this._saveDocument('profile_claim_requests', claimData);
  }

  public static async createAdminNotification(notificationData: any): Promise<{ success: boolean; error?: string }> {
    return this._saveDocument('admin_notifications', notificationData);
  }
}

export default AdminService;