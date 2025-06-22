import FirebaseService from './firebase-service.js';
import { db, adminDb } from '../api/firebase-config.js';

import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, getDoc } from 'firebase/firestore';

class AdminService extends FirebaseService {

  // =========================================================
  // METODI GESTIONE UTENTI (Approvazione/Rifiuto/Eliminazione)
  // =========================================================

  /**
   * Elimina un utente da Firestore tramite email.
   * @param email L'email dell'utente da eliminare.
   */
  static async deleteUserByEmail(email) {
    try {
      if (!db) return { success: false, error: "Database non configurato" };

      const uid = email;
      const userDocRef = doc(db, 'utenti', uid);
      await deleteDoc(userDocRef);
      return { success: true };
    } catch (error) {
      return this.handleError(error, `deleteUserByEmail`);
    }
  }

  /**
   * Recupera tutti gli utenti con stato "pending".
   */
  static async getPendingUsers() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'utenti'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getPendingUsers');
      return [];
    }
  }

  /**
   * Approva un utente cambiando il suo stato in "active".
   */
  static async approveUser(userId) {
    try {
      if (!db) return { success: false, error: 'Database non disponibile' };
      const userRef = doc(db, 'utenti', userId);
      await updateDoc(userRef, { status: 'active', approved_at: new Date().toISOString() });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'approveUser');
    }
  }

  /**
   * Rifiuta un utente, inviando una notifica e cancellando il documento.
   */
  static async rejectUser(userId, reason) {
    try {
      if (!db) return { success: false, error: 'Database non disponibile' };

      // Invia una notifica all'utente prima di eliminarlo
      const userDoc = await getDoc(doc(db, 'utenti', userId));
      if (userDoc.exists()) {
        const notifRef = collection(db, 'user_notifications');
        await addDoc(notifRef, {
          user_id: userId,
          type: 'account_rejected',
          title: 'Account rifiutato',
          message: reason || 'La tua richiesta di account è stata rifiutata.',
          created_at: new Date().toISOString()
        });
      }

      // Elimina l'account utente da Firestore
      await deleteDoc(doc(db, 'utenti', userId));
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectUser');
    }
  }

  // =========================================================
  // METODI GESTIONE RICHIESTE (Premium, Claim Profilo)
  // =========================================================

  static async getPendingPremiumRequests() {
    try {
      if (!db) return [];
      const q = query(collection(db, 'premium_requests'), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      this.handleError(error, 'getPendingPremiumRequests');
      return [];
    }
  }

  static async approvePremiumRequest(requestId) {
    try {
      if (!db) return { success: false, error: 'Database non disponibile' };

      const requestDoc = await getDoc(doc(db, 'premium_requests', requestId));
      if (!requestDoc.exists()) return { success: false, error: 'Richiesta non trovata' };

      const requestData = requestDoc.data();

      // Aggiorna l'utente a premium
      const userRef = doc(db, 'utenti', requestData.user_email);
      await updateDoc(userRef, { premium: true, premium_activated_at: new Date().toISOString() });

      // Aggiorna lo stato della richiesta
      await updateDoc(doc(db, 'premium_requests', requestId), { status: 'approved', approved_at: new Date().toISOString() });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'approvePremiumRequest');
    }
  }

  static async rejectPremiumRequest(requestId, reason) {
    try {
      if (!db) return { success: false, error: 'Database non disponibile' };

      const requestDocRef = doc(db, 'premium_requests', requestId);
      await updateDoc(requestDocRef, {
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        rejection_reason: reason
      });

      return { success: true };
    } catch (error) {
      return this.handleError(error, 'rejectPremiumRequest');
    }
  }

  static async saveProfileClaimRequest(claimData) {
    return this._saveDocument('profile_claim_requests', claimData);
  }

  static async createAdminNotification(notificationData) {
    return this._saveDocument('admin_notifications', notificationData);
  }
}

export default AdminService; 