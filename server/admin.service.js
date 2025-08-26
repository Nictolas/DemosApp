import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

class AdminService {

  // =========================================================
  // METODI GESTIONE UTENTI (Approvazione/Rifiuto/Eliminazione)
  // =========================================================

  /**
   * Elimina un utente da Firestore tramite email.
   * @param email L'email dell'utente da eliminare.
   */
  static async deleteUserByEmail(email) {
    try {
      if (!pool) return { success: false, error: "Database non configurato" };

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

      // Invia notifica di approvazione all'utente
      await addDoc(collection(db, 'user_notifications'), {
        user_id: userId,
        type: 'account_approved',
        title: 'Account Approvato!',
        message: 'Il tuo account è stato approvato. Ora puoi accedere a tutte le funzionalità.',
        created_at: new Date().toISOString()
      });

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
          title: 'Richiesta Rifiutata',
          message: reason || 'La tua richiesta di registrazione non è stata approvata.',
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