import { db } from '../api/firebase-config.js';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';

class OpinioniProposteService {
  // Lista tutte le opinioni proposte ordinate per voti
  static async listOpinioniProposte() {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'opinioni_proposte'));
    const opinioni = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    // Ordina per voti decrescente
    return opinioni.sort((a, b) => b.voti - a.voti);
  }

  // Aggiunge una nuova opinione proposta
  static async addOpinioneProposta({ testo, proponente, proponente_email }) {
    if (!db) return { success: false, error: 'Database non configurato' };
    
    try {
      const docRef = await addDoc(collection(db, 'opinioni_proposte'), {
        testo,
        proponente,
        proponente_email,
        voti: 0,
        votanti: [],
        data_creazione: new Date().toISOString()
      });
      
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Vota un'opinione proposta
  static async votaOpinioneProposta(opinioneId, userId) {
    if (!db) return { success: false, error: 'Database non configurato' };
    
    try {
      const opinioneRef = doc(db, 'opinioni_proposte', opinioneId);
      const opinioneDoc = await getDocs(query(collection(db, 'opinioni_proposte'), where('__name__', '==', opinioneId)));
      
      if (opinioneDoc.empty) {
        return { success: false, error: 'Opinione non trovata' };
      }
      
      const opinioneData = opinioneDoc.docs[0].data();
      
      // Verifica se l'utente ha già votato
      if (opinioneData.votanti && opinioneData.votanti.includes(userId)) {
        return { success: false, error: 'Hai già votato questa opinione' };
      }
      
      // Aggiorna voti e votanti
      await updateDoc(opinioneRef, {
        voti: increment(1),
        votanti: arrayUnion(userId)
      });
      
      return { success: true };
    } catch (error) {
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