import pool from './config/database.js';

class OpinioniService {
  static async listOpinioni() {
    try {
      const result = await pool.query('SELECT * FROM opinioni ORDER BY created_at DESC');
      return result.rows;
    } catch (error) {
      console.error('Error fetching opinioni:', error);
      return [];
    }
  }

  static async addOpinione({ id, text }) {
    try {
      const opinioneId = require('crypto').randomUUID();
      await pool.query(
        'INSERT INTO opinioni (id, text, source, original_proponente) VALUES ($1, $2, $3, $4)',
        [id, text, 'admin', 'admin']
      );
      return { success: true };
    } catch (error) {
      console.error('Error adding opinione:', error);
      return { success: false, error: 'Errore nel salvataggio dell\'opinione' };
    }
  }

  static async deleteOpinione(opinioneId) {
    try {
      // 1. Elimina dalla tabella opinioni
      await pool.query('DELETE FROM opinioni WHERE id = $1', [opinioneId]);
      
      // 2. Rimuovi il campo da tutti gli utenti (se necessario)
      // Nota: In PostgreSQL, le opinioni degli utenti potrebbero essere gestite diversamente
      // Per ora eliminiamo solo dalla tabella opinioni
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting opinione:', error);
      return { success: false, error: 'Errore nell\'eliminazione dell\'opinione' };
    }
  }

  static async updateOpinione(opinioneId, newText) {
    try {
      const result = await pool.query(
        'UPDATE opinioni SET text = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newText, opinioneId]
      );
      
      if (result.rowCount === 0) {
        return { success: false, error: 'Opinione non trovata' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating opinione:', error);
      return { success: false, error: 'Errore nell\'aggiornamento dell\'opinione' };
    }
  }
}

export default OpinioniService;