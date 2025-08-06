import { pool } from './database-config.js';

class OpinioniProposteService {
  // Lista tutte le opinioni proposte ordinate per voti
  static async listOpinioniProposte() {
    try {
      const [rows] = await pool.execute('SELECT * FROM opinioni_proposte ORDER BY voti DESC');
      return rows;
    } catch (error) {
      console.error('Errore nel recupero opinioni proposte:', error);
      return [];
    }
  }

  // Aggiunge una nuova opinione proposta
  static async addOpinioneProposta({ testo, proponente, proponente_email }) {
    try {
      const opinioneId = require('crypto').randomUUID();
      await pool.execute(
        'INSERT INTO opinioni_proposte (id, testo, proponente, proponente_email, voti, votanti, data_creazione) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [opinioneId, testo, proponente, proponente_email, 0, JSON.stringify([]), new Date().toISOString()]
      );
      
      return { success: true, id: opinioneId };
    } catch (error) {
      console.error('Error adding opinione proposta:', error);
      return { success: false, error: error.message };
    }
  }

  // Vota un'opinione proposta
  static async votaOpinioneProposta(opinioneId, userId) {
    try {
      // Verifica se l'opinione esiste e se l'utente ha già votato
      const [rows] = await pool.execute(
        'SELECT voti, votanti FROM opinioni_proposte WHERE id = ?',
        [opinioneId]
      );
      
      if (rows.length === 0) {
        return { success: false, error: 'Opinione non trovata' };
      }
      
      const opinioneData = rows[0];
      const votanti = JSON.parse(opinioneData.votanti || '[]');
      
      // Verifica se l'utente ha già votato
      if (votanti.includes(userId)) {
        return { success: false, error: 'Hai già votato questa opinione' };
      }
      
      // Aggiorna voti e votanti
      votanti.push(userId);
      await pool.execute(
        'UPDATE opinioni_proposte SET voti = voti + 1, votanti = ? WHERE id = ?',
        [JSON.stringify(votanti), opinioneId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error voting opinione proposta:', error);
      return { success: false, error: error.message };
    }
  }

  // Rimuovi voto da un'opinione proposta
  static async rimuoviVotoOpinioneProposta(opinioneId, userId) {
    if (!db) return { success: false, error: 'Database non configurato' };
    
    try {
      const opinioneRef = doc(db, 'opinioni_proposte', opinioneId);
      const opinioneDoc = await getDocs(query(collection(db, 'opinioni_proposte'), where('__name__', '==', opinioneId)));
      
      if (opinioneDoc.empty) {
        return { success: false, error: 'Opinione non trovata' };
      }
      
      const opinioneData = opinioneDoc.docs[0].data();
      
      // Verifica se l'utente ha effettivamente votato
      if (!opinioneData.votanti || !opinioneData.votanti.includes(userId)) {
        return { success: false, error: 'Non hai votato questa opinione' };
      }
      
      // Aggiorna voti e votanti
      await updateDoc(opinioneRef, {
        voti: increment(-1),
        votanti: arrayRemove(userId)
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Ottieni i voti di un utente
  static async getUserVoti(userId) {
    if (!db) return [];
    
    try {
      const snapshot = await getDocs(collection(db, 'opinioni_proposte'));
      const userVoti = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.votanti && data.votanti.includes(userId)) {
          userVoti.push(doc.id);
        }
      });
      
      return userVoti;
    } catch (error) {
      console.error('Errore nel recupero voti utente:', error);
      return [];
    }
  }

  // Elimina un'opinione proposta (solo admin)
  static async deleteOpinioneProposta(opinioneId) {
    if (!db) return { success: false, error: 'Database non configurato' };
    
    try {
      await deleteDoc(doc(db, 'opinioni_proposte', opinioneId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Accetta un'opinione proposta (solo admin) - la sposta nelle opinioni ufficiali
  static async accettaOpinioneProposta(opinioneId) {
    if (!db) return { success: false, error: 'Database non configurato' };
    
    try {
      // Recupera l'opinione proposta
      const opinioneDoc = await getDocs(query(collection(db, 'opinioni_proposte'), where('__name__', '==', opinioneId)));
      
      if (opinioneDoc.empty) {
        return { success: false, error: 'Opinione non trovata' };
      }
      
      const opinioneData = opinioneDoc.docs[0].data();
      
      // Aggiungi alle opinioni ufficiali
      await addDoc(collection(db, 'opinioni'), {
        id: `proposta_${Date.now()}`,
        text: opinioneData.testo,
        source: 'proposta_utente',
        original_proponente: opinioneData.proponente
      });
      
      // Elimina dalla proposta
      await deleteDoc(doc(db, 'opinioni_proposte', opinioneId));
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default OpinioniProposteService; 